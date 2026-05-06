#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#include "nvs.h"
#include "nvs_flash.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"

#include "wifi_manager.h"
#include "web_portal.h"

static const char *TAG = "WIFI_MGR";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1

static EventGroupHandle_t s_wifi_event_group;
static int s_retry_num = 0;
static int s_max_retry = 10;

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
            ESP_LOGW(TAG, "Retry connect... %d/%d", s_retry_num, s_max_retry);
        }
        else
        {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            ESP_LOGE(TAG, "WiFi connect failed");
        }
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);

        /* Stop captive portal — we are connected to main WiFi */
        web_portal_stop();
    }
}

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

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL));

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

bool wifi_try_connect_saved(int timeout_ms)
{
    char ssid[33] = {0};
    char pass[65] = {0};

    if (!wifi_load_credentials(ssid, sizeof(ssid), pass, sizeof(pass)))
    {
        ESP_LOGW(TAG, "No saved WiFi credentials");
        return false;
    }

    ESP_LOGI(TAG, "Trying saved WiFi SSID: %s", ssid);

    wifi_init_common();

    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, pass, sizeof(wifi_config.sta.password));

    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.pmf_cfg.capable = true;
    wifi_config.sta.pmf_cfg.required = false;

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

    ESP_LOGW(TAG, "Cannot connect saved WiFi");
    return false;
}

void wifi_start_config_portal(void)
{
    wifi_init_common();

    wifi_config_t ap_config = {
        .ap = {
            .ssid = "LUMO_SETUP",
            .ssid_len = 10,
            .channel = 1,
            .password = "12345678",
            .max_connection = 4,
            .authmode = WIFI_AUTH_WPA_WPA2_PSK,
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

    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, pass, sizeof(wifi_config.sta.password));

    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    wifi_config.sta.pmf_cfg.capable = true;
    wifi_config.sta.pmf_cfg.required = false;

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