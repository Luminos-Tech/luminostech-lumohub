#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <stdbool.h>

bool wifi_try_connect_saved(int timeout_ms);
bool wifi_save_credentials(const char *ssid, const char *pass);
bool wifi_load_credentials(char *ssid, int ssid_len, char *pass, int pass_len);
void wifi_start_config_portal(void);
void wifi_connect_new_credentials(const char *ssid, const char *pass);
bool wifi_is_connected(void);

/* Captive portal — included here so main.c only needs wifi_manager.h */
void web_portal_stop(void);
bool web_portal_is_active(void);

#endif
