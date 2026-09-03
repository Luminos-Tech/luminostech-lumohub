#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "esp_err.h"
#include "esp_log.h"
#include "host/ble_hs.h"
#include "host/ble_hs_mbuf.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "nvs_flash.h"
#include "os/os_mbuf.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

#include "lumo_band_config.h"
#include "lumo_ble.h"

static const char *TAG = "lumo_ble";

/* NimBLE stores 128-bit UUID bytes least-significant byte first. */
static const ble_uuid128_t service_uuid = BLE_UUID128_INIT(
    0x01, 0x10, 0x8f, 0x2e, 0x6d, 0x6a, 0x3a, 0x8c,
    0x7b, 0x4f, 0x5a, 0x5d, 0x01, 0x00, 0x5a, 0x7c);
static const ble_uuid128_t tx_uuid = BLE_UUID128_INIT(
    0x01, 0x10, 0x8f, 0x2e, 0x6d, 0x6a, 0x3a, 0x8c,
    0x7b, 0x4f, 0x5a, 0x5d, 0x02, 0x00, 0x5a, 0x7c);
static const ble_uuid128_t rx_uuid = BLE_UUID128_INIT(
    0x01, 0x10, 0x8f, 0x2e, 0x6d, 0x6a, 0x3a, 0x8c,
    0x7b, 0x4f, 0x5a, 0x5d, 0x03, 0x00, 0x5a, 0x7c);

static uint8_t own_addr_type;
static uint16_t connection_handle = BLE_HS_CONN_HANDLE_NONE;
static uint16_t tx_value_handle;
static bool tx_subscribed;

static int gap_event(struct ble_gap_event *event, void *arg);

static int rx_access(uint16_t conn_handle,
                     uint16_t attr_handle,
                     struct ble_gatt_access_ctxt *ctxt,
                     void *arg)
{
    uint8_t data[256];
    uint16_t data_len = 0;
    int rc;

    (void)conn_handle;
    (void)attr_handle;
    (void)arg;

    if (ctxt->op != BLE_GATT_ACCESS_OP_WRITE_CHR) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    rc = ble_hs_mbuf_to_flat(ctxt->om, data, sizeof(data), &data_len);
    if (rc != 0) {
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }

    ESP_LOGI(TAG, "Received %u byte(s) from BLE peer", data_len);
    ESP_LOG_BUFFER_HEX_LEVEL(TAG, data, data_len, ESP_LOG_INFO);
    /* TODO: Decode phone or companion-hub commands here. */
    return 0;
}

static const struct ble_gatt_svc_def gatt_services[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &service_uuid.u,
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                .uuid = &tx_uuid.u,
                .flags = BLE_GATT_CHR_F_NOTIFY,
                .val_handle = &tx_value_handle,
            },
            {
                .uuid = &rx_uuid.u,
                .access_cb = rx_access,
                .flags = BLE_GATT_CHR_F_WRITE | BLE_GATT_CHR_F_WRITE_NO_RSP,
            },
            {0},
        },
    },
    {0},
};

static void advertise(void)
{
    struct ble_hs_adv_fields fields = {0};
    struct ble_gap_adv_params params = {0};
    const char *name = ble_svc_gap_device_name();
    int rc;

    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.name = (uint8_t *)name;
    fields.name_len = strlen(name);
    fields.name_is_complete = 1;
    fields.uuids128 = (ble_uuid128_t *)&service_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;

    rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to set advertising data: %d", rc);
        return;
    }

    params.conn_mode = BLE_GAP_CONN_MODE_UND;
    params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    rc = ble_gap_adv_start(own_addr_type, NULL, BLE_HS_FOREVER,
                           &params, gap_event, NULL);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to start advertising: %d", rc);
        return;
    }

    ESP_LOGI(TAG, "Advertising as %s", LUMO_BAND_DEVICE_NAME);
}

static int gap_event(struct ble_gap_event *event, void *arg)
{
    (void)arg;

    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if (event->connect.status == 0) {
            connection_handle = event->connect.conn_handle;
            ESP_LOGI(TAG, "BLE peer connected; handle=%u", connection_handle);
        } else {
            ESP_LOGW(TAG, "BLE connection failed: %d", event->connect.status);
            advertise();
        }
        return 0;

    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGI(TAG, "BLE peer disconnected; reason=%d",
                 event->disconnect.reason);
        connection_handle = BLE_HS_CONN_HANDLE_NONE;
        tx_subscribed = false;
        advertise();
        return 0;

    case BLE_GAP_EVENT_SUBSCRIBE:
        if (event->subscribe.attr_handle == tx_value_handle) {
            tx_subscribed = event->subscribe.cur_notify != 0;
            ESP_LOGI(TAG, "TX notifications %s",
                     tx_subscribed ? "enabled" : "disabled");
        }
        return 0;

    case BLE_GAP_EVENT_ADV_COMPLETE:
        advertise();
        return 0;

    case BLE_GAP_EVENT_MTU:
        ESP_LOGI(TAG, "BLE MTU updated: %u", event->mtu.value);
        return 0;

    default:
        return 0;
    }
}

static void on_reset(int reason)
{
    ESP_LOGE(TAG, "NimBLE host reset; reason=%d", reason);
}

static void on_sync(void)
{
    int rc;

    rc = ble_hs_util_ensure_addr(0);
    if (rc != 0) {
        ESP_LOGE(TAG, "No usable BLE address: %d", rc);
        return;
    }

    rc = ble_hs_id_infer_auto(0, &own_addr_type);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to select BLE address: %d", rc);
        return;
    }

    advertise();
}

static void host_task(void *param)
{
    (void)param;
    ESP_LOGI(TAG, "NimBLE host task started");
    nimble_port_run();
    nimble_port_freertos_deinit();
}

esp_err_t lumo_ble_init(void)
{
    esp_err_t err;
    int rc;

    err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES ||
        err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        err = nvs_flash_erase();
        if (err == ESP_OK) {
            err = nvs_flash_init();
        }
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "NVS initialization failed: %s", esp_err_to_name(err));
        return err;
    }

    rc = nimble_port_init();
    if (rc != ESP_OK) {
        ESP_LOGE(TAG, "nimble_port_init failed: %d", rc);
        return ESP_FAIL;
    }

    ble_hs_cfg.reset_cb = on_reset;
    ble_hs_cfg.sync_cb = on_sync;

    ble_svc_gap_init();
    ble_svc_gatt_init();

    rc = ble_svc_gap_device_name_set(LUMO_BAND_DEVICE_NAME);
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to set BLE name: %d", rc);
        return ESP_FAIL;
    }

    rc = ble_gatts_count_cfg(gatt_services);
    if (rc == 0) {
        rc = ble_gatts_add_svcs(gatt_services);
    }
    if (rc != 0) {
        ESP_LOGE(TAG, "Failed to register GATT service: %d", rc);
        return ESP_FAIL;
    }

    nimble_port_freertos_init(host_task);
    return ESP_OK;
}

esp_err_t lumo_ble_notify(const uint8_t *data, size_t len)
{
    struct os_mbuf *packet;
    int rc;

    if (data == NULL || len == 0 || len > UINT16_MAX) {
        return ESP_ERR_INVALID_ARG;
    }
    if (connection_handle == BLE_HS_CONN_HANDLE_NONE || !tx_subscribed) {
        return ESP_ERR_INVALID_STATE;
    }

    packet = ble_hs_mbuf_from_flat(data, (uint16_t)len);
    if (packet == NULL) {
        return ESP_ERR_NO_MEM;
    }

    rc = ble_gatts_notify_custom(connection_handle, tx_value_handle, packet);
    return rc == 0 ? ESP_OK : ESP_FAIL;
}
