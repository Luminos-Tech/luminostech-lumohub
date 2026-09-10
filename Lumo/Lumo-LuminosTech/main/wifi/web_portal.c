#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

#include "esp_log.h"
#include "esp_http_server.h"
#include "esp_system.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "lwip/raw.h"
#include "lwip/pbuf.h"
#include "lwip/ip4.h"
#include "lwip/ip_addr.h"
#include "lwip/udp.h"
#include "lwip/netif.h"
#include "lwip/timeouts.h"

#include "wifi_manager.h"
#include "web_portal.h"

/* ─────────────────────────────────────────────────────────────────────────
 * Constants & Configuration
 * ───────────────────────────────────────────────────────────────────────── */
static const char *TAG = "WEB_PORTAL";

/* IP 192.168.4.1 — AP default gateway */
static const uint8_t CAPTIVE_IP[4] = {192, 168, 4, 1};
#define CAPTIVE_PORT_HTTP   80
#define CAPTIVE_PORT_DNS    53

/* ─────────────────────────────────────────────────────────────────────────
 * Global state
 * ───────────────────────────────────────────────────────────────────────── */
static httpd_handle_t http_server = NULL;
static struct raw_pcb *dns_pcb = NULL;
static bool captive_active = false;

/* ─────────────────────────────────────────────────────────────────────────
 * DNS Server (raw lwIP PCB — full IP/UDP header control)
 *
 * Why raw PCB instead of udp_pcb?
 *   - We need to send from the softAP interface's IP (192.168.4.1)
 *   - Raw PCB lets us manually build the complete IP+UDP+DNS response
 *   - udp_pcb would send from whatever route is selected by routing table
 * ───────────────────────────────────────────────────────────────────────── */

/* Build a DNS A-record response for a given query.
 * Returns total response length (IP+UDP+DNS). */
static int dns_build_full_response(const uint8_t *query, int qlen,
                                   uint8_t *resp, int rmax)
{
    if (rmax < 29)
        return 0;

    /* Parse transaction ID from query (first 2 bytes) */
    uint16_t tx_id = (query[0] << 8) | query[1];

    /* IP header */
    uint8_t ip_len = 20;
    uint8_t udp_len = 8;
    uint16_t dns_len = (uint16_t)(qlen + 16); /* original query + answer section */
    uint16_t total_len = ip_len + udp_len + dns_len;

    /* ── IP header ─────────────────────────────── */
    resp[0]  = 0x45;                  /* version=4, IHL=5 */
    resp[1]  = 0x00;                  /* DSCP + ECN */
    resp[2]  = (total_len >> 8) & 0xFF;
    resp[3]  = total_len & 0xFF;     /* total length */
    resp[4]  = 0x00; resp[5] = 0x00; /* identification */
    resp[6]  = 0x40; resp[7] = 0x00; /* flags=DF, fragment offset=0 */
    resp[8]  = 64;                     /* TTL */
    resp[9]  = 17;                     /* protocol = UDP */
    resp[10] = 0x00; resp[11] = 0x00; /* checksum = 0 (will fill later) */

    /* Source IP = CAPTIVE_IP (192.168.4.1) */
    memcpy(&resp[12], CAPTIVE_IP, 4);
    /* Dest IP = source IP from query (offset 24 in IP header) */
    memcpy(&resp[16], &query[24], 4);

    /* Compute IP header checksum */
    uint32_t sum = 0;
    for (int i = 0; i < 10; i++)
    {
        uint16_t w = (resp[i * 2] << 8) | resp[i * 2 + 1];
        sum += w;
    }
    while (sum >> 16)
        sum = (sum & 0xFFFF) + (sum >> 16);
    uint16_t ip_chk = ~(uint16_t)sum;
    resp[10] = (ip_chk >> 8) & 0xFF;
    resp[11] = ip_chk & 0xFF;

    /* ── UDP header ────────────────────────────── */
    uint8_t *udp = &resp[ip_len];
    /* Source port = 53, dest port = from query (offset 22-23) */
    udp[0] = 0x00; udp[1] = 53;
    memcpy(&udp[2], &query[22], 2);
    /* UDP length */
    udp[4] = (udp_len + dns_len) >> 8;
    udp[5] = (udp_len + dns_len) & 0xFF;
    /* UDP checksum = 0 (optional for IPv4, set to 0) */
    udp[6] = 0x00; udp[7] = 0x00;

    /* ── DNS response ──────────────────────────── */
    uint8_t *dns = &resp[ip_len + udp_len];

    /* Transaction ID */
    dns[0] = (tx_id >> 8) & 0xFF;
    dns[1] = tx_id & 0xFF;

    /* Flags: QR=1 (response), AA=1, RD=1, RA=1 → 0x8580
     * 1000 0101 1000 0000 */
    dns[2] = 0x85;
    dns[3] = 0x80;

    /* Question count = 1, Answer count = 1 */
    dns[4] = 0x00; dns[5] = 0x01;
    dns[6] = 0x00; dns[7] = 0x01;

    /* Authority / Additional = 0 */
    dns[8] = 0x00; dns[9] = 0x00;
    dns[10] = 0x00; dns[11] = 0x00;

    /* Copy question name from query (skip DNS header = 12 bytes) */
    int qpos = 12;
    while (qpos < qlen && qpos < qlen)
    {
        uint8_t len = query[qpos];
        if (len == 0) { qpos++; break; }
        if ((len & 0xC0) == 0xC0) { qpos += 2; break; }
        qpos++;
        for (int i = 0; i < (len & 0x3F) && qpos < qlen; i++)
            qpos++;
    }
    int qname_len = qpos - 12;
    if (qname_len > 253) qname_len = 253;
    memcpy(&dns[12], &query[12], qname_len);
    int dp = 12 + qname_len;

    /* QTYPE and QCLASS after question name — save before writing */
    uint8_t saved_qtype  = query[dp + qname_len];
    uint8_t saved_qclass = query[dp + qname_len + 2];
    dp += qname_len;
    dns[dp++] = saved_qtype;    /* QTYPE  = 1 (A record) */
    dns[dp++] = saved_qclass;  /* QCLASS = 1 (IN) */

    /* ── Answer section ───────────────────────── */
    /* Name pointer to question (0xC00C = byte 12) */
    dns[dp++] = 0xC0;
    dns[dp++] = 0x0C;

    /* Type A */
    dns[dp++] = 0x00;
    dns[dp++] = 0x01;

    /* Class IN */
    dns[dp++] = 0x00;
    dns[dp++] = 0x01;

    /* TTL = 300 seconds */
    dns[dp++] = 0x00;
    dns[dp++] = 0x00;
    dns[dp++] = 0x01;
    dns[dp++] = 0x2C;

    /* RDLENGTH = 4 (IPv4) */
    dns[dp++] = 0x00;
    dns[dp++] = 0x04;

    /* RDATA = 192.168.4.1 */
    memcpy(&dns[dp], CAPTIVE_IP, 4);
    dp += 4;

    return ip_len + udp_len + dp - (ip_len + udp_len); /* total = ip + udp + dns */
}

static uint8_t dns_raw_recv(void *arg, struct raw_pcb *pcb,
                            struct pbuf *p, const ip_addr_t *addr)
{
    (void)arg; (void)pcb; (void)addr;

    if (p == NULL)
        return 1;

    /* We need at least: IP(20) + UDP(8) + DNS header(12) = 40 bytes */
    if (p->len < 40)
        goto done;

    uint8_t *pkt = (uint8_t *)p->payload;

    /* Read IP header length: (version & 0x0F) * 4 */
    uint8_t ihl = (pkt[0] & 0x0F) * 4;
    if (p->len < ihl + 8 + 12)
        goto done;

    /* Verify protocol = UDP (17) */
    if (pkt[9] != 17)
        goto done;

    /* Verify destination port = 53 (in UDP header at offset ihl+2) */
    uint8_t *udp_hdr = pkt + ihl;
    if (udp_hdr[2] != 0x00 || udp_hdr[3] != 53)
        goto done;

    /* Get source IP from IP header (offset 12) */
    uint8_t src_ip[4];
    memcpy(src_ip, pkt + 12, 4);

    /* Get UDP source port */
    uint16_t src_port = ((uint16_t)udp_hdr[0] << 8) | udp_hdr[1];

    /* Extract DNS query payload */
    uint8_t *dns_payload = udp_hdr + 8;
    int dns_len = p->len - ihl - 8;
    if (dns_len < 12)
        goto done;

    /* Build response */
    uint8_t resp[512];
    int resp_len = dns_build_full_response(dns_payload, dns_len, resp, sizeof(resp));
    if (resp_len == 0)
        goto done;

    /* Fix dest IP in response to source IP of query */
    memcpy(&resp[16], src_ip, 4);

    /* Fix source IP in response to our captive IP */
    memcpy(&resp[12], CAPTIVE_IP, 4);

    /* Fix IP total length */
    resp_len = (resp[2] << 8) | resp[3];
    /* Re-calc IP len = 20 + 8 + dns payload len */
    int new_dns_len = dns_len + 16;
    int new_total = 20 + 8 + new_dns_len;
    resp[2] = (new_total >> 8) & 0xFF;
    resp[3] = new_total & 0xFF;
    resp_len = new_total;

    /* Fix UDP src port = 53, dest port = original source port */
    memcpy(&resp[20], &udp_hdr[2], 2);  /* dest port = client port */
    resp[22] = 0x00; resp[23] = 53;     /* src port = 53 */

    /* Fix UDP length */
    int udp_total = 8 + new_dns_len;
    resp[24] = (udp_total >> 8) & 0xFF;
    resp[25] = udp_total & 0xFF;

    /* Re-compute IP checksum */
    uint32_t sum = 0;
    for (int i = 0; i < 10; i++)
    {
        uint16_t w = ((uint16_t)resp[i * 2] << 8) | resp[i * 2 + 1];
        sum += w;
    }
    while (sum >> 16)
        sum = (sum & 0xFFFF) + (sum >> 16);
    uint16_t ip_chk = ~(uint16_t)sum;
    resp[10] = (ip_chk >> 8) & 0xFF;
    resp[11] = ip_chk & 0xFF;

    ESP_LOGD(TAG, "DNS query from %d.%d.%d.%d:%d -> responding with captive IP",
             src_ip[0], src_ip[1], src_ip[2], src_ip[3], src_port);

    struct pbuf *pb = pbuf_alloc(PBUF_RAW, resp_len, PBUF_RAM);
    if (pb)
    {
        memcpy(pb->payload, resp, resp_len);
        raw_sendto(pcb, pb, (ip_addr_t *)src_ip);
        pbuf_free(pb);
    }

done:
    pbuf_free(p);
    return 1;
}

/* ─────────────────────────────────────────────────────────────────────────
 * DNS Server lifecycle
 * ───────────────────────────────────────────────────────────────────────── */
static void dns_server_start(void)
{
    if (dns_pcb != NULL)
        return;

    dns_pcb = raw_new(IP_PROTO_UDP);
    if (dns_pcb == NULL)
    {
        ESP_LOGE(TAG, "Failed to create DNS raw PCB");
        return;
    }

    ip_addr_t bind_addr;
    IP_ADDR4(&bind_addr, CAPTIVE_IP[0], CAPTIVE_IP[1], CAPTIVE_IP[2], CAPTIVE_IP[3]);

    err_t err = raw_bind(dns_pcb, &bind_addr);
    if (err != ERR_OK)
    {
        ESP_LOGE(TAG, "DNS raw_bind failed: %d", err);
        raw_remove(dns_pcb);
        dns_pcb = NULL;
        return;
    }

    raw_recv(dns_pcb, dns_raw_recv, NULL);

    ESP_LOGI(TAG, "DNS server started on %d.%d.%d.%d:53 (captive portal redirect)",
             CAPTIVE_IP[0], CAPTIVE_IP[1], CAPTIVE_IP[2], CAPTIVE_IP[3]);
}

static void dns_server_stop(void)
{
    if (dns_pcb == NULL)
        return;
    raw_remove(dns_pcb);
    dns_pcb = NULL;
    ESP_LOGI(TAG, "DNS server stopped");
}

/* ─────────────────────────────────────────────────────────────────────────
 * HTTP Server — Captive Portal Routes
 * ───────────────────────────────────────────────────────────────────────── */

/* HTML: WiFi config form (modern dark gradient UI) */
static const char *html_config =
    "<!DOCTYPE html>"
    "<html lang=\"vi\">"
    "<head>"
    "<meta charset=\"UTF-8\">"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
    "<title>LumoHub WiFi Setup</title>"
    "<style>"
    "*{box-sizing:border-box;margin:0;padding:0}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
    "background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);"
    "min-height:100vh;display:flex;align-items:center;justify-content:center;"
    "padding:20px}"
    ".card{background:#fff;border-radius:20px;padding:32px 30px;width:100%;max-width:480px;"
    "box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center}"
    ".icon{font-size:48px;margin-bottom:6px}"
    "h2{color:#302b63;font-size:22px;margin-bottom:4px}"
    ".sub{color:#888;font-size:13px;margin-bottom:22px}"
    ".field{margin-bottom:14px;text-align:left}"
    "label{display:block;color:#444;font-size:13px;font-weight:600;margin-bottom:6px}"
    "input,select{width:100%;padding:11px 14px;border:2px solid #e0e0e0;border-radius:12px;"
    "font-size:15px;outline:none;background:#fff;transition:border-color .2s}"
    "input:focus,select:focus{border-color:#6c63ff}"
    ".row{display:flex;gap:8px;align-items:stretch}"
    ".row select{flex:1}"
    ".row button{flex:0 0 auto;padding:0 14px;background:#eef0ff;color:#4834d4;"
    "border:2px solid #d6d8ff;border-radius:12px;font-weight:700;font-size:13px;"
    "cursor:pointer;transition:background .15s}"
    ".row button:hover{background:#dfe1ff}"
    ".row button:disabled{opacity:.5;cursor:wait}"
    ".btn{width:100%;padding:14px;background:linear-gradient(135deg,#6c63ff,#4834d4);"
    "color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;"
    "cursor:pointer;transition:transform .1s,opacity .2s;margin-top:6px}"
    ".btn:hover{opacity:.88}"
    ".btn:active{transform:scale(.97)}"
    ".btn:disabled{opacity:.5;cursor:not-allowed}"
    ".info{margin-top:14px;font-size:12px;color:#aaa}"
    ".status{margin-bottom:14px;padding:10px;border-radius:8px;font-size:13px;display:none}"
    ".status.ok{display:block;background:#d4edda;color:#155724}"
    ".status.fail{display:block;background:#f8d7da;color:#721c24}"
    ".status.loading{display:block;background:#fff3cd;color:#856404}"
    ".net{font-size:13px;color:#444;text-align:left}"
    ".net .meta{color:#888;font-size:11px;margin-left:6px}"
    ".net.saved::before{content:\"\\2713 \";color:#27ae60;font-weight:700}"
    "</style>"
    "</head>"
    "<body>"
    "<div class=card>"
    "<div class=icon>&#128268;</div>"
    "<h2>LumoHub WiFi Setup</h2>"
    "<p class=sub>Chon WiFi gan day hoac nhap tay, roi nhap mat khau.</p>"
    "<div id=\"status\"></div>"
    "<form id=\"wf\" method=POST action=/api/connect>"
    "<div class=field>"
    "<label>WiFi gan day</label>"
    "<div class=row>"
    "<select id=\"pick\" name=\"ssid\" required>"
    "<option value=\"\">--- Chon WiFi ---</option>"
    "<option value=\"__manual__\">Nhap tay (SSID khac)...</option>"
    "</select>"
    "<button type=button id=\"rescan\">Quet lai</button>"
    "</div>"
    "</div>"
    "<div class=field id=\"manualWrap\" style=\"display:none\">"
    "<label>Hoac nhap SSID khac</label>"
    "<input id=\"ssidCustom\" name=\"ssid_custom\" placeholder=\"VD: WifiNhaBan\" maxlength=32>"
    "</div>"
    "<div class=field>"
    "<label>Mat khau WiFi</label>"
    "<input name=pass type=password placeholder=\"Bo trong neu WiFi khong co mat khau\" maxlength=64>"
    "</div>"
    "<button class=btn type=submit id=\"submit\">Luu &amp; Ket Noi</button>"
    "</form>"
    "<p class=info>Nut \"Quet lai\" se yeu cau ESP32 quet lai cac mang WiFi xung quanh.</p>"
    "</div>"
    "<script>"
    "var pick=document.getElementById('pick'),"
    "manualWrap=document.getElementById('manualWrap'),"
    "ssidCustom=document.getElementById('ssidCustom'),"
    "rescan=document.getElementById('rescan'),"
    "statusEl=document.getElementById('status'),"
    "form=document.getElementById('wf'),"
    "submitBtn=document.getElementById('submit');"
    ""
    "function showStatus(txt,kind){"
    "statusEl.className='status '+kind;statusEl.textContent=txt;statusEl.style.display='block';"
    "}"
    ""
    "pick.onchange=function(){"
    "if(pick.value==='__manual__'){manualWrap.style.display='block';ssidCustom.required=true;}"
    "else{manualWrap.style.display='none';ssidCustom.required=false;}"
    "};"
    ""
    "form.onsubmit=function(){"
    "if(pick.value==='__manual__'){pick.disabled=true;ssidCustom.name='ssid';}"
    "submitBtn.disabled=true;showStatus('Dang luu va ket noi...','loading');"
    "};"
    ""
    "rescan.onclick=function(){"
    "rescan.disabled=true;rescan.textContent='Dang quet...';"
    "fetch('/api/scan').then(function(r){return r.json();}).then(function(j){"
    "rescan.disabled=false;rescan.textContent='Quet lai';"
    "renderList(j.networks||[]);"
    "if((j.networks||[]).length){showStatus('Tim thay '+(j.networks||[]).length+' mang WiFi.','ok');}"
    "else{showStatus('Khong tim thay mang WiFi nao.','fail');}"
    "}).catch(function(){rescan.disabled=false;rescan.textContent='Quet lai';showStatus('Loi khi quet.','fail');});"
    "};"
    ""
    "function renderList(networks){"
    "var saved=networks.filter(function(n){return n.saved;}).map(function(n){return n.ssid;});"
    "var html='<option value=\"\">--- Chon WiFi ---</option>';"
    "networks.forEach(function(n){"
    "var r=n.rssi,signal='Yeu';if(r>=-55)signal='Manh';else if(r>=-70)signal='Trung binh';"
    "var label=n.ssid+' ('+signal+' - '+r+'dBm)';"
    "if(n.saved)label='\\u2713 '+label;"
    "html+='<option value=\"'+n.ssid.replace(/\"/g,'&quot;')+'\">'+label+'</option>';"
    "});"
    "html+='<option value=\"__manual__\">Nhap tay (SSID khac)...</option>';"
    "pick.innerHTML=html;"
    "if(saved.length){"
    "for(var i=0;i<pick.options.length;i++){if(saved.indexOf(pick.options[i].value)>=0){pick.selectedIndex=i;break;}}"
    "}"
    "}"
    ""
    "// Auto-scan on page load"
    "window.addEventListener('load',function(){rescan.click();});"
    "</script>"
    "</body>"
    "</html>";

/* HTML: Success after saving */
static const char *html_success =
    "<!DOCTYPE html>"
    "<html lang=\"vi\">"
    "<head>"
    "<meta charset=\"UTF-8\">"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
    "<title>LumoHub - Da luu</title>"
    "<style>"
    "*{box-sizing:border-box;margin:0;padding:0}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
    "background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);"
    "min-height:100vh;display:flex;align-items:center;justify-content:center;"
    "padding:20px}"
    ".card{background:#fff;border-radius:20px;padding:40px 35px;width:100%;max-width:440px;"
    "box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center}"
    ".icon{font-size:64px;margin-bottom:16px}"
    "h2{color:#27ae60;font-size:22px;margin-bottom:8px}"
    "p{color:#666;font-size:14px;line-height:1.6}"
    ".ok{color:#27ae60}"
    "</style>"
    "<meta http-equiv=\"refresh\" content=\"4;url=/\">"
    "</head>"
    "<body>"
    "<div class=card>"
    "<div class=icon>&#10004;&#65039;</div>"
    "<h2>Da luu thanh cong!</h2>"
    "<p>ESP32 dang thu ket noi WiFi.<br>"
    "<span class=ok>Kiem tra man hinh OLED de xem trang thai.</span><br><br>"
    "Trang se tu dong tai sau 4 giay.</p>"
    "</div>"
    "</body>"
    "</html>";

/* ─── URL decode ──────────────────────────────────────────────────── */
static void url_decode(char *dst, const char *src)
{
    char a, b;
    while (*src)
    {
        if (*src == '%' &&
            (a = src[1], b = src[2]) &&
            isxdigit((unsigned char)a) && isxdigit((unsigned char)b))
        {
            if (a >= 'a') a -= 'a' - 'A';
            if (a >= 'A') a = a - 'A' + 10;
            else          a -= '0';
            if (b >= 'a') b -= 'a' - 'A';
            if (b >= 'A') b = b - 'A' + 10;
            else          b -= '0';
            *dst++ = (char)(16 * a + b);
            src += 3;
        }
        else if (*src == '+')
        {
            *dst++ = ' ';
            src++;
        }
        else
        {
            *dst++ = *src++;
        }
    }
    *dst = '\0';
}

/* ─── Parse POST form body ────────────────────────────────────────── */
static void parse_form(const char *body, char *ssid, size_t ssid_len,
                       char *pass, size_t pass_len)
{
    char *copy = strdup(body);
    if (!copy) return;
    char *tok = strtok(copy, "&");
    while (tok)
    {
        if (strncmp(tok, "ssid=", 5) == 0)
            url_decode(ssid, tok + 5);
        else if (strncmp(tok, "pass=", 5) == 0)
            url_decode(pass, tok + 5);
        tok = strtok(NULL, "&");
    }
    ssid[ssid_len - 1] = 0;
    pass[pass_len - 1] = 0;
    free(copy);
}

/* ─── HTTP handlers ───────────────────────────────────────────────── */
static esp_err_t root_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html; charset=utf-8");
    httpd_resp_send(req, html_config, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

static const char *authmode_to_str(uint8_t authmode)
{
    switch (authmode)
    {
        case WIFI_AUTH_OPEN:            return "OPEN";
        case WIFI_AUTH_WEP:             return "WEP";
        case WIFI_AUTH_WPA_PSK:         return "WPA";
        case WIFI_AUTH_WPA2_PSK:        return "WPA2";
        case WIFI_AUTH_WPA_WPA2_PSK:    return "WPA/WPA2";
        case WIFI_AUTH_WPA3_PSK:        return "WPA3";
        case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-ENT";
        default:                        return "UNKNOWN";
    }
}

/* GET /api/scan  -> JSON {networks:[{ssid,rssi,auth,saved}]} */
static esp_err_t scan_handler(httpd_req_t *req)
{
    wifi_network_info_t nets[WIFI_SCAN_MAX_NETWORKS];
    int n = wifi_scan_networks(nets, WIFI_SCAN_MAX_NETWORKS);

    /* Build JSON by hand (no extra deps). Worst-case size: ~80 bytes per entry. */
    size_t cap = 64 + (size_t)n * 96;
    char *out = malloc(cap);
    if (!out)
    {
        httpd_resp_set_status(req, "500 Internal Server Error");
        httpd_resp_send(req, "{\"networks\":[]}", HTTPD_RESP_USE_STRLEN);
        return ESP_OK;
    }

    size_t len = 0;
    int w = snprintf(out + len, cap - len, "{\"networks\":[");
    if (w > 0) len += (size_t)w;
    for (int i = 0; i < n; i++)
    {
        /* Escape SSID for JSON: simple backslash + quote handling */
        char esc[96];
        size_t p = 0;
        for (size_t k = 0; nets[i].ssid[k] && p < sizeof(esc) - 2; k++)
        {
            char c = nets[i].ssid[k];
            if (c == '\\' || c == '\"') { esc[p++] = '\\'; esc[p++] = c; }
            else if ((uint8_t)c < 0x20) { /* skip control chars */ }
            else                         { esc[p++] = c; }
        }
        esc[p] = '\0';

        if (len + 128 < cap)
        {
            int n2 = snprintf(out + len, cap - len,
                              "%s{\"ssid\":\"%s\",\"rssi\":%d,\"auth\":\"%s\",\"saved\":%s}",
                              (i == 0 ? "" : ","),
                              esc,
                              (int)nets[i].rssi,
                              authmode_to_str(nets[i].authmode),
                              nets[i].saved ? "true" : "false");
            if (n2 > 0) len += (size_t)n2;
        }
    }
    int tail = snprintf(out + len, cap - len, "]}");
    if (tail > 0 && (size_t)tail < cap - len) len += (size_t)tail;

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, out, len);
    free(out);
    return ESP_OK;
}

/* POST /api/connect  form-encoded: ssid=&pass=  (or ssid_custom= renamed by client) */
static esp_err_t connect_handler(httpd_req_t *req)
{
    char *buf = malloc(req->content_len + 1);
    if (!buf) { httpd_resp_send_500(req); return ESP_FAIL; }

    int ret = httpd_req_recv(req, buf, req->content_len);
    if (ret <= 0) { free(buf); httpd_resp_send_500(req); return ESP_FAIL; }
    buf[ret] = '\0';

    char ssid[64] = {0}, pass[64] = {0};
    parse_form(buf, ssid, sizeof(ssid), pass, sizeof(pass));
    free(buf);

    if (ssid[0] == '\0')
    {
        httpd_resp_set_status(req, "400 Bad Request");
        httpd_resp_set_type(req, "text/plain");
        httpd_resp_send(req, "Missing ssid", HTTPD_RESP_USE_STRLEN);
        return ESP_OK;
    }

    ESP_LOGI(TAG, "WiFi credentials received -- SSID: %s", ssid);
    wifi_connect_new_credentials(ssid, pass);

    httpd_resp_set_type(req, "text/html; charset=utf-8");
    httpd_resp_send(req, html_success, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── Captive portal detection handler ──────────────────────────────
 * These paths are checked by Android/iOS/Windows when connecting to AP.
 * We MUST redirect (302) or serve the config page, NOT return 404 or 204.
 * Returning 204 (success) would make Android think there is internet
 * and suppress the captive portal popup. */
static esp_err_t captive_handler(httpd_req_t *req)
{
    char uri[64] = {0};
    httpd_req_get_hdr_value_str(req, "Host", uri, sizeof(uri) - 1);

    ESP_LOGI(TAG, "Captive route hit: %s", uri);

    httpd_resp_set_status(req, "302 Found");
    httpd_resp_set_hdr(req, "Location", "http://192.168.4.1/");
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, "<html><body>Redirecting...</body></html>", HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── Catch-all for unknown paths ────────────────────────────────── */
static esp_err_t notfound_handler(httpd_req_t *req)
{
    char uri[64] = {0};
    httpd_req_get_hdr_value_str(req, "Host", uri, sizeof(uri) - 1);

    ESP_LOGI(TAG, "Unknown path hit from %s, redirecting", uri);

    httpd_resp_set_status(req, "302 Found");
    httpd_resp_set_hdr(req, "Location", "http://192.168.4.1/");
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, "<html><body>Redirecting...</body></html>", HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Public API
 * ───────────────────────────────────────────────────────────────────────── */
void web_portal_start(void)
{
    if (http_server != NULL)
    {
        ESP_LOGW(TAG, "HTTP server already running");
        return;
    }

    /* Start DNS server first (captive portal redirect) */
    dns_server_start();

    /* Start HTTP server on port 80 */
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = CAPTIVE_PORT_HTTP;
    config.max_open_sockets = 4;
    config.max_uri_handlers = 16;  // captive portal cần 13 handlers (root, save, scan, gen204, hotspot, ncsi, success_lib, connecttest, success_txt, fwlink, fallback...)
    config.lru_purge_enable = true;
    config.recv_wait_timeout = 5;
    config.send_wait_timeout = 5;
    /* Fix lỗi "Header fields are long" khi POST form WiFi credentials.
     * Default chỉ 512 bytes; browser gửi thêm Referer/Cookie/Accept-Language
     * dễ vượt giới hạn → ESP32 trả 431 Request Header Fields Too Large. */
    config.max_req_hdr_len = 1024;

    if (httpd_start(&http_server, &config) != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to start HTTP server");
        dns_server_stop();
        return;
    }

    captive_active = true;

    /* ── Main routes ── */
    httpd_uri_t root = {
        .uri = "/",
        .method = HTTP_GET,
        .handler = root_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t save = {
        .uri = "/api/connect",
        .method = HTTP_POST,
        .handler = connect_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t scan = {
        .uri = "/api/scan",
        .method = HTTP_GET,
        .handler = scan_handler,
        .user_ctx = NULL,
    };

    /* ── Android captive portal detection ── */
    httpd_uri_t gen204 = {
        .uri = "/generate_204",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t gen204b = {
        .uri = "/gen_204",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };

    /* ── Apple captive portal detection ── */
    httpd_uri_t hotspot = {
        .uri = "/hotspot-detect.html",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t ncsi = {
        .uri = "/ncsi.txt",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t success_lib = {
        .uri = "/library/test/success.html",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };

    /* ── Windows captive portal detection ── */
    httpd_uri_t connecttest = {
        .uri = "/connecttest.txt",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t success_txt = {
        .uri = "/success.txt",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t fwlink = {
        .uri = "/fwlink",
        .method = HTTP_GET,
        .handler = captive_handler,
        .user_ctx = NULL,
    };

    /* ── Catch-all (unknown paths → captive redirect) ── */
    httpd_uri_t fallback = {
        .uri = "/*",
        .method = HTTP_GET,
        .handler = notfound_handler,
        .user_ctx = NULL,
    };
    httpd_uri_t fallback_post = {
        .uri = "/*",
        .method = HTTP_POST,
        .handler = notfound_handler,
        .user_ctx = NULL,
    };

    /* Register all routes */
    httpd_register_uri_handler(http_server, &root);
    httpd_register_uri_handler(http_server, &save);
    httpd_register_uri_handler(http_server, &scan);
    httpd_register_uri_handler(http_server, &gen204);
    httpd_register_uri_handler(http_server, &gen204b);
    httpd_register_uri_handler(http_server, &hotspot);
    httpd_register_uri_handler(http_server, &ncsi);
    httpd_register_uri_handler(http_server, &success_lib);
    httpd_register_uri_handler(http_server, &connecttest);
    httpd_register_uri_handler(http_server, &success_txt);
    httpd_register_uri_handler(http_server, &fwlink);
    httpd_register_uri_handler(http_server, &fallback);
    httpd_register_uri_handler(http_server, &fallback_post);

    ESP_LOGI(TAG, "Captive portal HTTP started on port %d", CAPTIVE_PORT_HTTP);
    ESP_LOGI(TAG, "AP IP: %d.%d.%d.%d — DNS redirect active on port %d",
             CAPTIVE_IP[0], CAPTIVE_IP[1], CAPTIVE_IP[2], CAPTIVE_IP[3], CAPTIVE_PORT_DNS);
    ESP_LOGI(TAG, "All domains -> %d.%d.%d.%d", CAPTIVE_IP[0], CAPTIVE_IP[1], CAPTIVE_IP[2], CAPTIVE_IP[3]);
}

void web_portal_stop(void)
{
    if (http_server)
    {
        httpd_stop(http_server);
        http_server = NULL;
        ESP_LOGI(TAG, "HTTP server stopped");
    }
    dns_server_stop();
    captive_active = false;
}

bool web_portal_is_active(void)
{
    return captive_active;
}
