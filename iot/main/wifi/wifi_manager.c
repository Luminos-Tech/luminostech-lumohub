#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

#include "nvs.h"
#include "nvs_flash.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"

#include "lwip/sockets.h"
#include "lwip/netdb.h"

#include "wifi_manager.h"
#include "web_portal.h"

static const char *TAG = "WIFI_MGR";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1

static EventGroupHandle_t s_wifi_event_group;
static int s_retry_num = 0;
static int s_max_retry = 10;

/* tracks whether we launched a config portal so the watchdog knows to clean up */
static bool s_portal_active = false;

/* ─── WiFi event handler ─────────────────────────────────────────────────── */

static void wifi_event_handler(void *arg,
                               esp_event_base_t event_base,
                               int32_t event_id,
                               void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect();
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
        if (s_retry_num < s_max_retry)
        {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGW(TAG, "Retry %d/%d", s_retry_num, s_max_retry);
        }
        else
        {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            ESP_LOGE(TAG, "WiFi connect failed after %d retries", s_max_retry);
        }
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

/* ─── Common WiFi init ───────────────────────────────────────────────────── */

static void wifi_init_common(void)
{
    static bool initialized = false;
    if (initialized)
        return;

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    s_wifi_event_group = xEventGroupCreate();

    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL));

    initialized = true;
}

/* ─── DNS captive-portal server ──────────────────────────────────────────── */

#define DNS_PORT 53
#define DNS_BUF_SIZE 512

/* g_dns_stop is declared in web_portal.c and set by web_portal_stop() */
extern volatile bool g_dns_stop;

static void dns_server_task(void *pvParameters)
{
    int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (sock < 0)
    {
        ESP_LOGE(TAG, "DNS socket() failed");
        vTaskDelete(NULL);
        return;
    }

    /* Non-blocking so we can check g_dns_stop periodically */
    int flags = 1;
    setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &flags, sizeof(flags));

    struct timeval tv = {.tv_sec = 1, .tv_usec = 0};
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));

    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(DNS_PORT),
        .sin_addr.s_addr = htonl(INADDR_ANY),
    };
    if (bind(sock, (struct sockaddr *)&addr, sizeof(addr)) < 0)
    {
        ESP_LOGE(TAG, "DNS bind() failed");
        close(sock);
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "DNS server running on port %d", DNS_PORT);

    uint8_t buf[DNS_BUF_SIZE];
    struct sockaddr_in client;
    socklen_t clen = sizeof(client);

    while (!g_dns_stop)
    {
        int len = recvfrom(sock, buf, sizeof(buf), 0,
                           (struct sockaddr *)&client, &clen);
        if (len < 12)
            continue; /* timeout or short packet */

        /* Build DNS response */
        buf[2] = 0x81;
        buf[3] = 0x80; /* QR=1, AA=1, RCODE=0 */
        buf[6] = 0x00;
        buf[7] = 0x01; /* answer count = 1 */
        buf[8] = buf[9] = buf[10] = buf[11] = 0x00;

        /* Skip question section */
        int pos = 12;
        while (pos < len && buf[pos] != 0)
        {
            pos += buf[pos] + 1;
        }
        pos += 5; /* null byte + QTYPE + QCLASS */

        if (pos > len || pos + 16 >= DNS_BUF_SIZE)
            continue;

        /* Answer: A record → 192.168.4.1 */
        buf[pos++] = 0xC0;
        buf[pos++] = 0x0C; /* name ptr */
        buf[pos++] = 0x00;
        buf[pos++] = 0x01; /* type A   */
        buf[pos++] = 0x00;
        buf[pos++] = 0x01; /* class IN */
        buf[pos++] = 0x00;
        buf[pos++] = 0x00; /* TTL hi   */
        buf[pos++] = 0x00;
        buf[pos++] = 0x3C; /* TTL 60s  */
        buf[pos++] = 0x00;
        buf[pos++] = 0x04; /* rdlen=4  */
        buf[pos++] = 192;
        buf[pos++] = 168;
        buf[pos++] = 4;
        buf[pos++] = 1;

        sendto(sock, buf, pos, 0, (struct sockaddr *)&client, clen);
    }

    ESP_LOGI(TAG, "DNS server stopped");
    close(sock);
    vTaskDelete(NULL);
}

/* ─── Portal watchdog ────────────────────────────────────────────────────── */
/*
 * Spawned by wifi_connect_new_credentials().
 * Waits for WIFI_CONNECTED_BIT then:
 *   1. Calls web_portal_stop()  → stops HTTP server + signals DNS task to exit
 *   2. Switches WiFi to STA-only mode (frees AP RAM ~40 KB)
 */

static void portal_watchdog_task(void *arg)
{
    /* Wait up to 30 s for a connection */
    EventBits_t bits = xEventGroupWaitBits(
        s_wifi_event_group,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdFALSE, pdFALSE,
        pdMS_TO_TICKS(30000));

    if (bits & WIFI_CONNECTED_BIT)
    {
        ESP_LOGI(TAG, "Connected — shutting down config portal to free RAM");

        /* Small delay so the browser can still fetch /status one last time */
        vTaskDelay(pdMS_TO_TICKS(2000));

        web_portal_stop();                /* stop HTTP + DNS   */
        esp_wifi_set_mode(WIFI_MODE_STA); /* drop AP interface */
        s_portal_active = false;

        ESP_LOGI(TAG, "Portal shut down. Free heap: %lu B",
                 (unsigned long)esp_get_free_heap_size());
    }
    else
    {
        ESP_LOGW(TAG, "Portal watchdog: connection timed out, portal kept alive");
    }

    vTaskDelete(NULL);
}

/* ─── NVS credential helpers ─────────────────────────────────────────────── */

bool wifi_save_credentials(const char *ssid, const char *pass)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open("wifi_cfg", NVS_READWRITE, &nvs);
    if (err != ESP_OK)
        return false;
    err = nvs_set_str(nvs, "ssid", ssid);
    err |= nvs_set_str(nvs, "pass", pass);
    err |= nvs_commit(nvs);
    nvs_close(nvs);
    return (err == ESP_OK);
}

bool wifi_load_credentials(char *ssid, int ssid_len, char *pass, int pass_len)
{
    nvs_handle_t nvs;
    size_t ssid_sz = (size_t)ssid_len;
    size_t pass_sz = (size_t)pass_len;
    esp_err_t err = nvs_open("wifi_cfg", NVS_READONLY, &nvs);
    if (err != ESP_OK)
        return false;
    err = nvs_get_str(nvs, "ssid", ssid, &ssid_sz);
    if (err != ESP_OK)
    {
        nvs_close(nvs);
        return false;
    }
    err = nvs_get_str(nvs, "pass", pass, &pass_sz);
    nvs_close(nvs);
    return (err == ESP_OK);
}

/* ─── wifi_try_connect_saved ─────────────────────────────────────────────── */

bool wifi_try_connect_saved(int timeout_ms)
{
    char ssid[33] = {0}, pass[65] = {0};
    if (!wifi_load_credentials(ssid, sizeof(ssid), pass, sizeof(pass)))
    {
        ESP_LOGW(TAG, "No saved credentials");
        return false;
    }

    ESP_LOGI(TAG, "Trying saved WiFi: %s", ssid);
    wifi_init_common();

    wifi_config_t cfg = {0};
    strncpy((char *)cfg.sta.ssid, ssid, sizeof(cfg.sta.ssid));
    strncpy((char *)cfg.sta.password, pass, sizeof(cfg.sta.password));
    cfg.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    cfg.sta.pmf_cfg.capable = true;
    cfg.sta.pmf_cfg.required = false;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    EventBits_t bits = xEventGroupWaitBits(
        s_wifi_event_group,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdFALSE, pdFALSE,
        pdMS_TO_TICKS(timeout_ms));

    if (bits & WIFI_CONNECTED_BIT)
    {
        ESP_LOGI(TAG, "Connected: %s", ssid);
        return true;
    }
    ESP_LOGW(TAG, "Could not connect to saved WiFi");
    return false;
}

/* ─── wifi_start_config_portal ───────────────────────────────────────────── */

void wifi_start_config_portal(void)
{
    wifi_init_common();

    wifi_config_t ap_cfg = {
        .ap = {
            .ssid = "LUMO SETUP",
            .ssid_len = 0,
            .channel = 6,
            .password = "12345678",
            .max_connection = 4,
            .authmode = WIFI_AUTH_WPA_WPA2_PSK,
        }};
    if (strlen((char *)ap_cfg.ap.password) == 0)
    {
        ap_cfg.ap.authmode = WIFI_AUTH_OPEN;
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());
    s_portal_active = true;

    ESP_LOGI(TAG, "────────────────────────────────────");
    ESP_LOGI(TAG, "Config portal started");
    ESP_LOGI(TAG, "AP SSID    : LUMO SETUP");
    ESP_LOGI(TAG, "AP Password: 12345678");
    ESP_LOGI(TAG, "Portal URL : http://192.168.4.1/");
    ESP_LOGI(TAG, "(Phone opens portal automatically)");
    ESP_LOGI(TAG, "────────────────────────────────────");

    /* DNS task — must start BEFORE HTTP so probes are caught immediately */
    xTaskCreate(dns_server_task, "dns_srv", 4096, NULL, 5, NULL);

    /* HTTP server */
    web_portal_start();
}

/* ─── wifi_connect_new_credentials ──────────────────────────────────────── */

void wifi_connect_new_credentials(const char *ssid, const char *pass)
{
    ESP_LOGI(TAG, "New credentials for: %s", ssid);
    wifi_save_credentials(ssid, pass);

    wifi_config_t cfg = {0};
    strncpy((char *)cfg.sta.ssid, ssid, sizeof(cfg.sta.ssid));
    strncpy((char *)cfg.sta.password, pass, sizeof(cfg.sta.password));
    cfg.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    cfg.sta.pmf_cfg.capable = true;
    cfg.sta.pmf_cfg.required = false;

    s_retry_num = 0;
    xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT);

    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &cfg));
    esp_wifi_connect();

    /* Watchdog task: shuts down portal automatically once connected */
    if (s_portal_active)
    {
        xTaskCreate(portal_watchdog_task, "portal_wd", 4096, NULL, 4, NULL);
    }
}

/* ─── wifi_is_connected ──────────────────────────────────────────────────── */

bool wifi_is_connected(void)
{
    if (!s_wifi_event_group)
        return false;
    return (xEventGroupGetBits(s_wifi_event_group) & WIFI_CONNECTED_BIT) != 0;
}