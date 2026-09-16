#include "esp_log.h"

#include "esp32_link.h"
#include "lumo_band_config.h"
#include "lumo_ble.h"

static const char *TAG = "lumo_link";

esp_err_t lumo_esp32_link_init(void)
{
    /*
     * BLE transport is implemented by lumo_ble.c. A phone or companion hub
     * acts as the central and connects to LUMO_BAND_SERVICE_UUID.
     *
     * TODO: If UART or another transport is selected, initialize it here.
     * TODO: Add framing, authentication, retry and offline queue policy.
     */
    ESP_LOGI(TAG, "BLE peer transport selected: %d", LUMO_ESP32_LINK_TRANSPORT);
    return ESP_OK;
}

esp_err_t lumo_esp32_link_send(const uint8_t *data, size_t len)
{
    /* Route messages through the selected transport. */
#if LUMO_ESP32_LINK_TRANSPORT == LUMO_LINK_TRANSPORT_BLE
    return lumo_ble_notify(data, len);
#elif LUMO_ESP32_LINK_TRANSPORT == LUMO_LINK_TRANSPORT_UART
    /* TODO: Send a framed message through the optional companion UART. */
    (void)data;
    (void)len;
    return ESP_OK;
#else
    /* TODO: Add the custom transport implementation. */
    (void)data;
    (void)len;
    return ESP_OK;
#endif
}
