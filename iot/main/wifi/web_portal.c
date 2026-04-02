#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

#include "esp_log.h"
#include "esp_http_server.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "wifi_manager.h"
#include "web_portal.h"

static const char *TAG = "WEB_PORTAL";
static httpd_handle_t server = NULL;

/* ─── DNS task stop flag ─────────────────────────────────────────────────── */
/* dns_server_task() reads this; web_portal_stop() sets it to true.          */
volatile bool g_dns_stop = false;

/* ─── Async scan state ───────────────────────────────────────────────────── */

#define MAX_APS 20
#define SCAN_JSON_SIZE 1024

typedef enum
{
    SCAN_IDLE,
    SCAN_RUNNING,
    SCAN_DONE,
    SCAN_ERROR
} scan_state_t;

static volatile scan_state_t s_scan_state = SCAN_IDLE;
static char s_scan_json[SCAN_JSON_SIZE];
static SemaphoreHandle_t s_scan_mutex = NULL;

static void scan_task(void *arg)
{
    wifi_scan_config_t cfg = {
        .ssid = NULL,
        .bssid = NULL,
        .channel = 0,
        .show_hidden = false,
        .scan_type = WIFI_SCAN_TYPE_ACTIVE,
    };

    esp_err_t err = esp_wifi_scan_start(&cfg, true); /* blocks in own 8 KB stack */
    if (err != ESP_OK)
    {
        xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
        snprintf(s_scan_json, sizeof(s_scan_json), "[]");
        s_scan_state = SCAN_ERROR;
        xSemaphoreGive(s_scan_mutex);
        vTaskDelete(NULL);
        return;
    }

    uint16_t ap_count = 0;
    esp_wifi_scan_get_ap_num(&ap_count);
    if (ap_count > MAX_APS)
        ap_count = MAX_APS;

    wifi_ap_record_t *records = calloc(ap_count, sizeof(wifi_ap_record_t));
    if (!records)
    {
        xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
        snprintf(s_scan_json, sizeof(s_scan_json), "[]");
        s_scan_state = SCAN_ERROR;
        xSemaphoreGive(s_scan_mutex);
        vTaskDelete(NULL);
        return;
    }
    esp_wifi_scan_get_ap_records(&ap_count, records);

    char tmp[SCAN_JSON_SIZE];
    int pos = 0;
    bool first = true;
    char seen[MAX_APS][33];
    int seen_n = 0;

    pos += snprintf(tmp + pos, sizeof(tmp) - pos, "[");
    for (int i = 0; i < ap_count && pos < (int)sizeof(tmp) - 80; i++)
    {
        const char *ssid = (const char *)records[i].ssid;
        if (!strlen(ssid))
            continue;

        bool dup = false;
        for (int s = 0; s < seen_n; s++)
        {
            if (strcmp(seen[s], ssid) == 0)
            {
                dup = true;
                break;
            }
        }
        if (dup)
            continue;
        if (seen_n < MAX_APS)
            strncpy(seen[seen_n++], ssid, 32);

        char esc[70] = {0};
        int j = 0;
        for (int k = 0; ssid[k] && j < 68; k++)
        {
            if (ssid[k] == '"' || ssid[k] == '\\')
                esc[j++] = '\\';
            esc[j++] = ssid[k];
        }

        pos += snprintf(tmp + pos, sizeof(tmp) - pos,
                        "%s{\"ssid\":\"%s\",\"rssi\":%d,\"auth\":%d}",
                        first ? "" : ",", esc,
                        records[i].rssi,
                        (records[i].authmode != WIFI_AUTH_OPEN) ? 1 : 0);
        first = false;
    }
    pos += snprintf(tmp + pos, sizeof(tmp) - pos, "]");
    free(records);

    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    memcpy(s_scan_json, tmp, pos + 1);
    s_scan_state = SCAN_DONE;
    xSemaphoreGive(s_scan_mutex);

    ESP_LOGI(TAG, "Scan done: %d APs", seen_n);
    vTaskDelete(NULL);
}

/* ─── HTML ───────────────────────────────────────────────────────────────── */

static const char *html_page =
    "<!DOCTYPE html><html><head>"
    "<meta charset='UTF-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>WiFi Setup</title>"
    "<style>"
    "body{font-family:-apple-system,sans-serif;background:#f0f4f8;margin:0;padding:16px}"
    ".card{background:#fff;border-radius:16px;padding:20px;max-width:420px;"
    "margin:0 auto;box-shadow:0 4px 16px rgba(0,0,0,.12)}"
    "h2{text-align:center;color:#1e3a5f;margin:0 0 4px}"
    ".sub{text-align:center;color:#64748b;font-size:13px;margin-bottom:18px}"
    ".ap-item{display:flex;align-items:center;padding:12px 8px;"
    "border-bottom:1px solid #f1f5f9;cursor:pointer;border-radius:8px;transition:background .15s}"
    ".ap-item:last-child{border-bottom:none}"
    ".ap-item:hover,.ap-item.sel{background:#eff6ff}"
    ".ap-name{flex:1;font-size:15px;font-weight:500;color:#1e293b}"
    ".rssi{font-size:11px;color:#94a3b8}"
    ".ico{font-size:18px;margin-right:8px}"
    ".divider{height:1px;background:#f1f5f9;margin:14px 0}"
    "#ps{display:none}"
    ".chosen{font-weight:600;color:#2563eb;margin-bottom:8px;font-size:14px}"
    "label{font-size:13px;color:#475569;display:block;margin-bottom:4px}"
    "input{width:100%;padding:11px 12px;border:1.5px solid #e2e8f0;border-radius:10px;"
    "font-size:15px;box-sizing:border-box;outline:none;transition:border .15s}"
    "input:focus{border-color:#2563eb}"
    ".btn{width:100%;padding:13px;border:none;border-radius:10px;font-size:15px;"
    "font-weight:600;cursor:pointer;margin-top:10px;transition:opacity .15s}"
    ".btn:hover{opacity:.85}"
    ".bp{background:#2563eb;color:#fff}"
    ".bs{background:#f1f5f9;color:#334155}"
    "#st{text-align:center;font-size:13px;color:#64748b;margin-top:10px;min-height:18px}"
    ".spin{display:inline-block;width:14px;height:14px;border:2px solid #e2e8f0;"
    "border-top-color:#2563eb;border-radius:50%;animation:sp .7s linear infinite;"
    "vertical-align:middle;margin-right:5px}"
    "@keyframes sp{to{transform:rotate(360deg)}}"
    ".empty{text-align:center;color:#94a3b8;padding:20px 0;font-size:14px}"
    ".success{background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;"
    "padding:16px;text-align:center;color:#166534;font-size:14px;margin-top:10px}"
    "</style></head><body>"
    "<div class='card'>"
    "<h2>&#x1F4F6; WiFi Setup</h2>"
    "<p class='sub'>Chọn mạng để kết nối thiết bị</p>"
    "<button class='btn bs' id='scanBtn' onclick='startScan()'>&#x1F50D; Quét mạng WiFi</button>"
    "<div id='list' style='margin-top:12px'>"
    "<p class='empty'>Nhấn nút để quét mạng</p>"
    "</div>"
    "<div class='divider'></div>"
    "<div id='ps'>"
    "<div id='cs' class='chosen'></div>"
    "<label>Mật khẩu WiFi</label>"
    "<input type='password' id='pw' placeholder='Nhập mật khẩu...'>"
    "<button class='btn bp' onclick='doConn()'>&#x1F517; Kết nối</button>"
    "</div>"
    "<div id='st'></div>"
    "</div>"
    "<script>"
    "var ss='';"
    "function setSt(m){document.getElementById('st').innerHTML=m;}"
    "function bars(r){"
    "if(r>=-55)return'&#x2588;&#x2588;&#x2588;&#x2588;';"
    "if(r>=-66)return'&#x2588;&#x2588;&#x2588;&thinsp;_';"
    "if(r>=-77)return'&#x2588;&#x2588;&thinsp;_&thinsp;_';"
    "return'&#x2588;&thinsp;_&thinsp;_&thinsp;_';}"
    "function startScan(){"
    "document.getElementById('list').innerHTML='<p class=\"empty\"><span class=\"spin\"></span>Đang quét...</p>';"
    "setSt('');"
    "fetch('/scan_start').then(function(){poll(0);}).catch(function(){setSt('Lỗi kết nối');});}"
    "function poll(n){"
    "fetch('/scan_result').then(function(r){return r.json();})"
    ".then(function(d){"
    "if(d.state==='running'){"
    "if(n<20){setTimeout(function(){poll(n+1);},500);}else{setSt('Quét quá lâu, thử lại');}"
    "return;}"
    "renderAPs(d.aps||[]);})"
    ".catch(function(){setSt('Lỗi, thử lại');});}"
    "function renderAPs(aps){"
    "if(!aps.length){document.getElementById('list').innerHTML='<p class=\"empty\">Không tìm thấy mạng</p>';return;}"
    "var h='';"
    "aps.forEach(function(ap){"
    "var lk=ap.auth?'&#x1F512;':'&#x1F513;';"
    "h+='<div class=\"ap-item\" onclick=\"pickAP(this,\\''+ap.ssid+'\\','+ap.auth+')\">';"
    "h+='<span class=\"ico\">'+lk+'</span>';"
    "h+='<span class=\"ap-name\">'+ap.ssid+'</span>';"
    "h+='<span class=\"rssi\">'+bars(ap.rssi)+' '+ap.rssi+'dBm</span>';"
    "h+='</div>';});"
    "document.getElementById('list').innerHTML=h;}"
    "function pickAP(el,s,auth){"
    "document.querySelectorAll('.ap-item').forEach(function(e){e.classList.remove('sel');});"
    "el.classList.add('sel');"
    "ss=s;"
    "document.getElementById('cs').innerText='\\uD83D\\uDCCD '+s;"
    "document.getElementById('ps').style.display='block';"
    "document.getElementById('pw').focus();}"
    /* After sending, poll /status every second to know when connected */
    "function doConn(){"
    "if(!ss){setSt('Vui lòng chọn mạng');return;}"
    "var p=document.getElementById('pw').value;"
    "setSt('<span class=\"spin\"></span>Đang gửi...');"
    "document.getElementById('scanBtn').disabled=true;"
    "fetch('/save',{method:'POST',"
    "headers:{'Content-Type':'application/x-www-form-urlencoded'},"
    "body:'ssid='+encodeURIComponent(ss)+'&pass='+encodeURIComponent(p)})"
    ".then(function(){"
    "setSt('<span class=\"spin\"></span>Đang kết nối tới <b>'+ss+'</b>...');"
    "pollStatus(0);})"
    ".catch(function(){setSt('&#x274C; Lỗi, thử lại');document.getElementById('scanBtn').disabled=false;});}"
    "function pollStatus(n){"
    "fetch('/status').then(function(r){return r.json();})"
    ".then(function(d){"
    "if(d.connected){"
    "document.getElementById('st').innerHTML='';"
    "document.getElementById('list').innerHTML='';"
    "document.getElementById('ps').style.display='none';"
    "document.getElementById('scanBtn').style.display='none';"
    "document.querySelector('.divider').style.display='none';"
    "document.getElementById('st').innerHTML="
    "'<div class=\"success\">&#x2705; Đã kết nối WiFi thành công!<br>"
    "<small>Portal sẽ tắt trong giây lát để tiết kiệm RAM.</small></div>';"
    "} else if(n<20){"
    "setTimeout(function(){pollStatus(n+1);},1500);"
    "} else {"
    "setSt('&#x26A0;&#xFE0F; Kết nối thất bại, kiểm tra lại mật khẩu.');"
    "document.getElementById('scanBtn').disabled=false;}})"
    ".catch(function(){"
    /* /status unreachable = portal already shut down = connected! */
    "document.getElementById('st').innerHTML="
    "'<div class=\"success\">&#x2705; Kết nối thành công! Portal đã đóng.</div>';});}"
    "window.onload=function(){startScan();};"
    "</script></body></html>";

/* ─── Captive-portal redirect ────────────────────────────────────────────── */

static esp_err_t captive_redirect_handler(httpd_req_t *req)
{
    httpd_resp_set_status(req, "302 Found");
    httpd_resp_set_hdr(req, "Location", "http://192.168.4.1/");
    httpd_resp_send(req, NULL, 0);
    return ESP_OK;
}

/* ─── GET / ──────────────────────────────────────────────────────────────── */

static esp_err_t root_get_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_page, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── GET /scan_start ────────────────────────────────────────────────────── */

static esp_err_t scan_start_handler(httpd_req_t *req)
{
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    if (s_scan_state != SCAN_RUNNING)
    {
        s_scan_state = SCAN_RUNNING;
        xTaskCreate(scan_task, "wifi_scan", 8192, NULL, 5, NULL);
    }
    xSemaphoreGive(s_scan_mutex);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, "{\"ok\":true}", HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── GET /scan_result ───────────────────────────────────────────────────── */

static esp_err_t scan_result_handler(httpd_req_t *req)
{
    xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
    scan_state_t state = s_scan_state;
    char local_json[SCAN_JSON_SIZE];
    if (state == SCAN_DONE || state == SCAN_ERROR)
    {
        strncpy(local_json, s_scan_json, sizeof(local_json));
    }
    xSemaphoreGive(s_scan_mutex);

    char resp[SCAN_JSON_SIZE + 24];
    if (state == SCAN_RUNNING || state == SCAN_IDLE)
    {
        snprintf(resp, sizeof(resp), "{\"state\":\"running\",\"aps\":[]}");
    }
    else
    {
        snprintf(resp, sizeof(resp), "{\"state\":\"done\",\"aps\":%s}", local_json);
        xSemaphoreTake(s_scan_mutex, portMAX_DELAY);
        s_scan_state = SCAN_IDLE;
        xSemaphoreGive(s_scan_mutex);
    }

    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Cache-Control", "no-store");
    httpd_resp_send(req, resp, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── GET /status ────────────────────────────────────────────────────────── */

static esp_err_t status_handler(httpd_req_t *req)
{
    bool connected = wifi_is_connected();
    char resp[32];
    snprintf(resp, sizeof(resp), "{\"connected\":%s}", connected ? "true" : "false");
    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Cache-Control", "no-store");
    httpd_resp_send(req, resp, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── POST /save ─────────────────────────────────────────────────────────── */

static void url_decode(char *dst, const char *src, size_t max)
{
    size_t w = 0;
    while (*src && w + 1 < max)
    {
        char a, b;
        if (*src == '%' && (a = src[1]) && (b = src[2]) &&
            isxdigit((unsigned char)a) && isxdigit((unsigned char)b))
        {
            if (a >= 'a')
                a -= 32;
            a = (a >= 'A') ? a - 'A' + 10 : a - '0';
            if (b >= 'a')
                b -= 32;
            b = (b >= 'A') ? b - 'A' + 10 : b - '0';
            *dst++ = 16 * a + b;
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
        w++;
    }
    *dst = '\0';
}

static void parse_form(const char *body,
                       char *ssid, size_t ssid_len,
                       char *pass, size_t pass_len)
{
    char *copy = strdup(body);
    if (!copy)
        return;
    char *token = strtok(copy, "&");
    while (token)
    {
        if (strncmp(token, "ssid=", 5) == 0)
            url_decode(ssid, token + 5, ssid_len);
        else if (strncmp(token, "pass=", 5) == 0)
            url_decode(pass, token + 5, pass_len);
        token = strtok(NULL, "&");
    }
    free(copy);
}

static esp_err_t save_post_handler(httpd_req_t *req)
{
    char buf[300] = {0};
    int ret = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (ret <= 0)
    {
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    char ssid[64] = {0}, pass[64] = {0};
    parse_form(buf, ssid, sizeof(ssid), pass, sizeof(pass));

    ESP_LOGI(TAG, "Connecting to SSID='%s'", ssid);
    wifi_connect_new_credentials(ssid, pass);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, "{\"ok\":true}", HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* ─── web_portal_stop ────────────────────────────────────────────────────── */

void web_portal_stop(void)
{
    if (server)
    {
        ESP_LOGI(TAG, "Stopping HTTP server");
        httpd_stop(server);
        server = NULL;
    }
    /* Signal the DNS task to exit on its next iteration */
    g_dns_stop = true;
    ESP_LOGI(TAG, "Web portal stopped — RAM freed");
}

/* ─── web_portal_start ───────────────────────────────────────────────────── */

void web_portal_start(void)
{
    if (!s_scan_mutex)
    {
        s_scan_mutex = xSemaphoreCreateMutex();
    }
    g_dns_stop = false;

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 14;
    config.stack_size = 8192;

    if (httpd_start(&server, &config) != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to start HTTP server");
        return;
    }

    httpd_uri_t routes[] = {
        {.uri = "/", .method = HTTP_GET, .handler = root_get_handler, .user_ctx = NULL},
        {.uri = "/scan_start", .method = HTTP_GET, .handler = scan_start_handler, .user_ctx = NULL},
        {.uri = "/scan_result", .method = HTTP_GET, .handler = scan_result_handler, .user_ctx = NULL},
        {.uri = "/status", .method = HTTP_GET, .handler = status_handler, .user_ctx = NULL},
        {.uri = "/save", .method = HTTP_POST, .handler = save_post_handler, .user_ctx = NULL},
        {.uri = "/hotspot-detect.html", .method = HTTP_GET, .handler = captive_redirect_handler, .user_ctx = NULL},
        {.uri = "/generate_204", .method = HTTP_GET, .handler = captive_redirect_handler, .user_ctx = NULL},
        {.uri = "/connecttest.txt", .method = HTTP_GET, .handler = captive_redirect_handler, .user_ctx = NULL},
        {.uri = "/ncsi.txt", .method = HTTP_GET, .handler = captive_redirect_handler, .user_ctx = NULL},
        {.uri = "/redirect", .method = HTTP_GET, .handler = captive_redirect_handler, .user_ctx = NULL},
    };

    for (int i = 0; i < (int)(sizeof(routes) / sizeof(routes[0])); i++)
    {
        httpd_register_uri_handler(server, &routes[i]);
    }

    ESP_LOGI(TAG, "Web portal started");
}