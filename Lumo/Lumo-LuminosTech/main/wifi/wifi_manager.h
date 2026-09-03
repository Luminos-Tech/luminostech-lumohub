#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <stdbool.h>
#include <stdint.h>

#define WIFI_SCAN_MAX_NETWORKS 20

typedef struct
{
    char ssid[33];
    int8_t rssi;
    uint8_t authmode; /* WIFI_AUTH_OPEN / WIFI_AUTH_WPA2_PSK / ... */
    bool saved;       /* true if credentials are already stored in NVS */
} wifi_network_info_t;

bool wifi_try_connect_saved(int timeout_ms);
bool wifi_save_credentials(const char *ssid, const char *pass);
bool wifi_load_credentials(char *ssid, int ssid_len, char *pass, int pass_len);
void wifi_start_config_portal(void);
void wifi_connect_new_credentials(const char *ssid, const char *pass);
bool wifi_is_connected(void);

/* Scan for nearby networks. Returns count, fills out[] up to max.
 * Networks with SSID hidden (ssid_len == 0) are skipped. */
int wifi_scan_networks(wifi_network_info_t *out, int max);

/* Captive portal — included here so main.c only needs wifi_manager.h */
void web_portal_stop(void);
bool web_portal_is_active(void);

#endif
