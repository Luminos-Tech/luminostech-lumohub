#include <stdio.h>
#include <string.h>
#include <stdbool.h>
#include <stdlib.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

#include "nvs.h"
#include "nvs_flash.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"

#include "wifi_manager.h"
#include "web_portal.h"

static const char *TAG = "WIFI_MGR";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1

/* ── Exponential backoff ────────────────────────────────────────
 * After exhausting s_max_retry fast retries, we schedule a background
 * reconnect timer with exponential back-off (10 s → 20 s → 40 s …
 * cap at WIFI_BACKOFF_CAP_S).  The timer re-triggers esp_wifi_connect()
 * until the device is back online.  IP_EVENT_STA_LOST_IP also triggers
 * a reconnect so transient DHCP renewals don't break the uplink. */
#define WIFI_BACKOFF_BASE_S   10
#define WIFI_BACKOFF_CAP_S    300
#define WIFI_BACKOFF_MAX_JITTER_MS 3000

static EventGroupHandle_t s_wifi_event_group;
static int                s_fast_retry_num   = 0;
static int                s_fast_max_retry   = 5;
static int64_t            s_backoff_s        = WIFI_BACKOFF_BASE_S;
static bool              s_backoff_scheduled = false;
static bool              s_have_credentials  = false;
static char              s_saved_ssid[33]   = {0};
static char              s_saved_pass[65]   = {0};

/* Forward declarations */
static void schedule_reconnect(int64_t delay_ms);
static void reconnect_timer_cb(void *arg);

/* ── Timer handle — allocated once and reused ─────────────────── */
static esp_timer_handle_t s_reconnect_timer;

/* ── Background reconnect task ────────────────────────────────── */
static void reconnect_task(void *arg)
{
    (void)arg;
    ESP_LOGI(TAG, "Background reconnect attempt");
    s_backoff_scheduled = false;
    esp_wifi_connect();
    vTaskDelete(NULL);
}

static int64_t backoff_duration_ms(void)
{
    int64_t jitter = (rand() % WIFI_BACKOFF_MAX_JITTER_MS);
    int64_t delay  = (s_backoff_s * 1000) + jitter;
    if (s_backoff_s < WIFI_BACKOFF_CAP_S)
        s_backoff_s *= 2;
    if (s_backoff_s > WIFI_BACKOFF_CAP_S)
        s_backoff_s = WIFI_BACKOFF_CAP_S;
    return delay;
}

static void schedule_reconnect(int64_t delay_ms)
{
    if (s_backoff_scheduled)
        return; // already pending

    int64_t backoff = backoff_duration_ms();
    if (delay_ms >= 0 && delay_ms < backoff)
        backoff = delay_ms;

    ESP_LOGI(TAG, "Scheduling reconnect in %lld ms (backoff now %lld s)",
             backoff, s_backoff_s);

    BaseType_t ret = xTaskCreate(&reconnect_task, "wifi_reconnect",
                                 4096, NULL, 3, NULL);
    if (ret != pdPASS)
    {
        ESP_LOGE(TAG, "Failed to spawn reconnect task");
        return;
    }
    s_backoff_scheduled = true;
}

static void schedule_reconnect_from_timer(void *arg)
{
    (void)arg;
    schedule_reconnect(-1);
}

static esp_timer_handle_t make_reconnect_timer(void)
{
    const esp_timer_create_args_t args = {
        .callback = &schedule_reconnect_from_timer,
        .arg      = NULL,
        .name     = "wifi_reconnect",
        .skip_unhandled_events = true,
    };
    esp_timer_handle_t h;
    ESP_ERROR_CHECK(esp_timer_create(&args, &h));
    return h;
}

static void disarm_backoff(void)
{
    s_backoff_s        = WIFI_BACKOFF_BASE_S;
    s_backoff_scheduled = false;
    s_fast_retry_num   = 0;
}

static void IRAM_ATTR wifi_event_handler(void *arg,
                                         esp_event_base_t event_base,
                                         int32_t event_id,
                                         void *event_data)
{
    (void)arg;

    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect();
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);

        /* FIX: chỉ stop portal khi STA thật sự đang connected mà bị mất.
         * Nếu vừa mới bật AP mode (config portal) thì KHÔNG stop,
         * vì disconnect hiện tại là do backoff retry, không phải do user. */
        static bool s_portal_was_active = false;
        if (web_portal_is_active())
        {
            s_portal_was_active = true;
        }
        if (s_portal_was_active && web_portal_is_active())
        {
            /* portal đang chạy — giữ nguyên, không stop */
            ESP_LOGD(TAG, "STA disconnected but AP portal active; keeping portal");
        }
        else
        {
            web_portal_stop();
        }

        if (!s_have_credentials)
        {
            ESP_LOGW(TAG, "No WiFi credentials stored — not reconnecting");
            return;
        }

        if (s_fast_retry_num < s_fast_max_retry)
        {
            /* Fast retry phase */
            esp_wifi_connect();
            s_fast_retry_num++;
            ESP_LOGW(TAG, "Fast retry %d/%d", s_fast_retry_num, s_fast_max_retry);
        }
        else
        {
            /* Exhausted fast retries — switch to exponential backoff */
            if (!s_backoff_scheduled)
            {
                /* IMPORTANT: while the captive portal is active, do NOT
                 * schedule more STA scan attempts. APSTA has to share the
                 * single RF chain on ESP32 — every STA probe drains the
                 * beacon budget and makes phones fail to see "LUMO_SETUP". */
                if (web_portal_is_active())
                {
                    ESP_LOGD(TAG, "Backoff paused while captive portal is active");
                    return;
                }

                ESP_LOGW(TAG, "Fast retries exhausted; entering backoff mode");
                schedule_reconnect(-1);
            }
        }
    }
}

static void IRAM_ATTR ip_event_handler(void *arg,
                                       esp_event_base_t event_base,
                                       int32_t event_id,
                                       void *event_data)
{
    (void)arg;

    if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));

        /* Successful connection — reset backoff state */
        disarm_backoff();
        s_backoff_scheduled = false;

        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);

        /* Stop captive portal */
        web_portal_stop();
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_LOST_IP)
    {
        ESP_LOGW(TAG, "Lost IP — attempting reconnect");
        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);

        /* Reset backoff so the next reconnect is fast */
        disarm_backoff();
        esp_wifi_connect();
    }
}

static void wifi_init_common(void)
{
    static bool initialized = false;
    if (initialized)
        return;

    s_reconnect_timer = make_reconnect_timer();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    s_wifi_event_group = xEventGroupCreate();

    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                              &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                              &ip_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_LOST_IP,
                                              &ip_event_handler, NULL));

    initialized = true;
}

bool wifi_save_credentials(const char *ssid, const char *pass)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open("wifi_cfg", NVS_READWRITE, &nvs);
    if (err != ESP_OK)
        return false;

    err |= nvs_set_str(nvs, "ssid", ssid);
    err |= nvs_set_str(nvs, "pass", pass);
    err |= nvs_commit(nvs);
    nvs_close(nvs);

    return err == ESP_OK;
}

bool wifi_load_credentials(char *ssid, int ssid_len, char *pass, int pass_len)
{
    nvs_handle_t nvs;
    size_t ssid_size = ssid_len;
    size_t pass_size = pass_len;

    esp_err_t err = nvs_open("wifi_cfg", NVS_READONLY, &nvs);
    if (err != ESP_OK)
        return false;

    err = nvs_get_str(nvs, "ssid", ssid, &ssid_size);
    if (err != ESP_OK)
    {
        nvs_close(nvs);
        return false;
    }

    err = nvs_get_str(nvs, "pass", pass, &pass_size);
    nvs_close(nvs);

    return err == ESP_OK;
}

/* Wipe stored credentials so the captive portal comes up clean.
 * Called from lumo_runtime when the button is held >= 5 s. */
void wifi_factory_reset(void)
{
    nvs_handle_t nvs;
    if (nvs_open("wifi_cfg", NVS_READWRITE, &nvs) == ESP_OK)
    {
        nvs_erase_all(nvs);
        nvs_commit(nvs);
        nvs_close(nvs);
        ESP_LOGW(TAG, "FACTORY RESET: wifi_cfg namespace erased");
    }
    else
    {
        ESP_LOGE(TAG, "FACTORY RESET: cannot open wifi_cfg");
    }
}

bool wifi_try_connect_saved(int timeout_ms)
{
    if (!wifi_load_credentials(s_saved_ssid, sizeof(s_saved_ssid),
                              s_saved_pass, sizeof(s_saved_pass)))
    {
        ESP_LOGW(TAG, "No saved WiFi credentials");
        s_have_credentials = false;
        return false;
    }

    /* DEBUG: log SSID/PASS thực sự lưu trong NVS (length + hex for whitespace) */
    ESP_LOGI(TAG, "Trying saved WiFi SSID: '%s' (len=%u)", s_saved_ssid, (unsigned)strlen(s_saved_ssid));
    ESP_LOGI(TAG, "  PASS length = %u", (unsigned)strlen(s_saved_pass));

    s_have_credentials = true;

    wifi_init_common();

    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, s_saved_ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, s_saved_pass, sizeof(wifi_config.sta.password));

    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.pmf_cfg.capable    = true;
    wifi_config.sta.pmf_cfg.required   = false;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    EventBits_t bits = xEventGroupWaitBits(
        s_wifi_event_group,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
        pdFALSE,
        pdFALSE,
        pdMS_TO_TICKS(timeout_ms));

    if (bits & WIFI_CONNECTED_BIT)
    {
        ESP_LOGI(TAG, "Connected to saved WiFi");
        return true;
    }

    ESP_LOGW(TAG, "Cannot connect saved WiFi within %d ms", timeout_ms);
    return false;
}

void wifi_start_config_portal(void)
{
    wifi_init_common();

    wifi_config_t ap_config = {
        .ap = {
            .ssid            = "LUMO_SETUP",
            .ssid_len        = 10,
            .channel         = 1,
            .password        = "12345678",
            .max_connection  = 4,
            .authmode        = WIFI_AUTH_WPA_WPA2_PSK,
        },
    };

    if (strlen((char *)ap_config.ap.password) == 0)
    {
        ap_config.ap.authmode = WIFI_AUTH_OPEN;
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Config portal started");
    ESP_LOGI(TAG, "AP SSID: LUMO_SETUP");
    ESP_LOGI(TAG, "AP PASS: 12345678");
    ESP_LOGI(TAG, "AP IP: 192.168.4.1");

    web_portal_start();
}

void wifi_connect_new_credentials(const char *ssid, const char *pass)
{
    ESP_LOGI(TAG, "Saving new WiFi credentials: %s", ssid);

    wifi_save_credentials(ssid, pass);
    strncpy(s_saved_ssid, ssid, sizeof(s_saved_ssid) - 1);
    strncpy(s_saved_pass, pass, sizeof(s_saved_pass) - 1);
    s_have_credentials = true;

    /* Reset backoff so the next reconnect is fast */
    disarm_backoff();

    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, pass, sizeof(wifi_config.sta.password));

    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.pmf_cfg.capable    = true;
    wifi_config.sta.pmf_cfg.required   = false;

    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    esp_wifi_connect();
}

bool wifi_is_connected(void)
{
    if (s_wifi_event_group == NULL)
    {
        return false;
    }

    EventBits_t bits = xEventGroupGetBits(s_wifi_event_group);
    return (bits & WIFI_CONNECTED_BIT) != 0;
}

/* Compare two SSIDs against saved credentials in NVS. */
static bool ssid_already_saved(const char *ssid)
{
    char saved_ssid[33] = {0};
    char saved_pass[65] = {0};
    if (!wifi_load_credentials(saved_ssid, sizeof(saved_ssid),
                               saved_pass, sizeof(saved_pass)))
    {
        return false;
    }
    return strcmp(saved_ssid, ssid) == 0;
}

int wifi_scan_networks(wifi_network_info_t *out, int max)
{
    if (out == NULL || max <= 0)
    {
        return 0;
    }

    wifi_init_common();

    /* Ensure STA interface is up before scan. */
    wifi_mode_t mode;
    if (esp_wifi_get_mode(&mode) != ESP_OK ||
        (mode != WIFI_MODE_STA && mode != WIFI_MODE_APSTA))
    {
        ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
        ESP_ERROR_CHECK(esp_wifi_start());
    }

    wifi_scan_config_t scan_config = {
        .ssid       = NULL,
        .bssid      = NULL,
        .channel    = 0,
        .show_hidden = false,
        .scan_type  = WIFI_SCAN_TYPE_ACTIVE,
        .scan_time.active.min = 100,
        .scan_time.active.max = 300,
    };

    esp_err_t err = esp_wifi_scan_start(&scan_config, true);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "wifi_scan_start failed: %s", esp_err_to_name(err));
        return 0;
    }

    uint16_t ap_count = 0;
    ESP_ERROR_CHECK(esp_wifi_scan_get_ap_num(&ap_count));
    if (ap_count == 0)
    {
        return 0;
    }

    uint16_t actual = (ap_count > (uint16_t)max) ? (uint16_t)max : ap_count;
    wifi_ap_record_t *ap_records = calloc(actual, sizeof(wifi_ap_record_t));
    if (ap_records == NULL)
    {
        ESP_LOGE(TAG, "Cannot allocate AP records");
        return 0;
    }

    uint16_t filled = actual;
    ESP_ERROR_CHECK(esp_wifi_scan_get_ap_records(&filled, ap_records));

    int written = 0;
    for (int i = 0; i < filled && written < max; i++)
    {
        if (ap_records[i].ssid[0] == '\0')
        {
            continue; /* skip hidden networks */
        }
        wifi_network_info_t *o = &out[written];
        memset(o, 0, sizeof(*o));
        strncpy(o->ssid, (const char *)ap_records[i].ssid,
                sizeof(o->ssid) - 1);
        o->rssi    = ap_records[i].rssi;
        o->authmode = ap_records[i].authmode;
        o->saved   = ssid_already_saved(o->ssid);
        written++;
    }

    /* Sort by RSSI descending (strongest first) */
    for (int i = 0; i < written - 1; i++)
    {
        for (int j = i + 1; j < written; j++)
        {
            if (out[j].rssi > out[i].rssi)
            {
                wifi_network_info_t tmp = out[i];
                out[i] = out[j];
                out[j] = tmp;
            }
        }
    }

    free(ap_records);

    ESP_LOGI(TAG, "Scan complete: %d network(s)", written);
    return written;
}
