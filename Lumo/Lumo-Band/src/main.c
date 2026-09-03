#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "esp_err.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_random.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "host/ble_hs.h"
#include "host/ble_hs_mbuf.h"
#include "host/util/util.h"
#include "mpu6050.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "nvs_flash.h"
#include "os/os_mbuf.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

#define DEVICE_NAME "LUMO-TEST-C3"
#define SAMPLE_SIZE 12U
#define BLE_PAYLOAD_VERSION 0x02U
#define BLE_SAMPLE_PERIOD_MS 1000
#define BLE_FALL_NOTIFY_PERIOD_MS 5000

static const char *TAG = "lumo_c3_band";

typedef struct __attribute__((packed)) {
    uint8_t version;
    uint8_t state;
    uint16_t magnitude_x100;
    uint16_t peak1s_x100;
    uint8_t heart_rate;
    uint16_t steps;
    uint8_t battery;
    uint8_t reserved0;
    uint8_t reserved1;
} ble_sample_payload_t;

_Static_assert(sizeof(ble_sample_payload_t) == SAMPLE_SIZE,
               "BLE payload must be exactly 12 bytes");

/* NimBLE stores UUID bytes least-significant first. */
static const ble_uuid128_t service_uuid = BLE_UUID128_INIT(
    0xf0, 0xde, 0xbc, 0x9a, 0x78, 0x56, 0x34, 0x12,
    0x78, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12);
static const ble_uuid128_t sample_uuid = BLE_UUID128_INIT(
    0xf1, 0xde, 0xbc, 0x9a, 0x78, 0x56, 0x34, 0x12,
    0x78, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12);

static uint8_t own_addr_type;
static uint8_t sample_value[SAMPLE_SIZE];
static uint16_t sample_handle;
static uint16_t connection_handle = BLE_HS_CONN_HANDLE_NONE;
static bool notify_enabled;
static portMUX_TYPE state_lock = portMUX_INITIALIZER_UNLOCKED;

static int gap_event(struct ble_gap_event *event, void *arg);

static const char *payload_state_name(uint8_t state)
{
    switch (state) {
    case 0:
        return "IDLE";
    case 1:
        return "MOVE";
    case 2:
        return "IMPACT_WAIT";
    case 3:
        return "FALL_CONFIRMED";
    case 4:
        return "SENSOR_OFFLINE";
    default:
        return "UNKNOWN";
    }
}

static uint8_t payload_state(const mpu6050_snapshot_t *snapshot)
{
    if (!snapshot->sensor_online) {
        return 4;
    }

    switch (snapshot->state) {
    case STATE_IMPACT_WAIT:
        return 2;
    case STATE_FALL_CONFIRMED:
        return 3;
    case STATE_RECOVERED:
        return 1;
    case STATE_IDLE:
        return snapshot->moving ? 1 : 0;
    default:
        return 4;
    }
}

static uint16_t float_to_x100(float value)
{
    if (value <= 0.0f) {
        return 0;
    }
    if (value >= 655.35f) {
        return UINT16_MAX;
    }
    return (uint16_t)(value * 100.0f + 0.5f);
}

static void log_ble_mac(void)
{
    uint8_t mac[6] = {0};
    esp_err_t err = esp_read_mac(mac, ESP_MAC_BT);

    /* Doc MAC BLE de Hub co the dung lam whitelist. */
    if (err != ESP_OK) {
        err = esp_efuse_mac_get_default(mac);
    }

    if (err == ESP_OK) {
        ESP_LOGI(TAG, "BLE MAC: %02X:%02X:%02X:%02X:%02X:%02X",
                 mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    } else {
        ESP_LOGE(TAG, "Cannot read BLE MAC: %s", esp_err_to_name(err));
    }
}

static int sample_access(uint16_t conn_handle,
                         uint16_t attr_handle,
                         struct ble_gatt_access_ctxt *ctxt,
                         void *arg)
{
    uint8_t snapshot[SAMPLE_SIZE];

    (void)conn_handle;
    (void)attr_handle;
    (void)arg;

    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) {
        return BLE_ATT_ERR_UNLIKELY;
    }

    portENTER_CRITICAL(&state_lock);
    memcpy(snapshot, sample_value, sizeof(snapshot));
    portEXIT_CRITICAL(&state_lock);

    return os_mbuf_append(ctxt->om, snapshot, sizeof(snapshot)) == 0
               ? 0
               : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static const struct ble_gatt_svc_def gatt_services[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &service_uuid.u,
        .characteristics = (struct ble_gatt_chr_def[]) {
            {
                .uuid = &sample_uuid.u,
                .access_cb = sample_access,
                .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
                .val_handle = &sample_handle,
            },
            {0},
        },
    },
    {0},
};

static void start_advertising(void)
{
    struct ble_hs_adv_fields fields = {0};
    struct ble_hs_adv_fields response = {0};
    struct ble_gap_adv_params params = {0};
    const char *name = ble_svc_gap_device_name();
    int rc;

    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.uuids128 = (ble_uuid128_t *)&service_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;
    rc = ble_gap_adv_set_fields(&fields);
    if (rc != 0) {
        ESP_LOGE(TAG, "Cannot set advertising data: %d", rc);
        return;
    }

    response.name = (uint8_t *)name;
    response.name_len = strlen(name);
    response.name_is_complete = 1;
    rc = ble_gap_adv_rsp_set_fields(&response);
    if (rc != 0) {
        ESP_LOGE(TAG, "Cannot set scan response: %d", rc);
        return;
    }

    params.conn_mode = BLE_GAP_CONN_MODE_UND;
    params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    rc = ble_gap_adv_start(own_addr_type, NULL, BLE_HS_FOREVER,
                           &params, gap_event, NULL);
    if (rc == 0) {
        ESP_LOGI(TAG, "Advertising as %s", DEVICE_NAME);
    } else {
        ESP_LOGE(TAG, "Cannot start advertising: %d", rc);
    }
}

static int gap_event(struct ble_gap_event *event, void *arg)
{
    (void)arg;

    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        if (event->connect.status == 0) {
            portENTER_CRITICAL(&state_lock);
            connection_handle = event->connect.conn_handle;
            notify_enabled = false;
            portEXIT_CRITICAL(&state_lock);
            ESP_LOGI(TAG, "Hub connected; handle=%u", connection_handle);
        } else {
            ESP_LOGW(TAG, "Connection failed: %d", event->connect.status);
            start_advertising();
        }
        return 0;

    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGI(TAG, "Hub disconnected; advertising again");
        portENTER_CRITICAL(&state_lock);
        connection_handle = BLE_HS_CONN_HANDLE_NONE;
        notify_enabled = false;
        portEXIT_CRITICAL(&state_lock);
        start_advertising();
        return 0;

    case BLE_GAP_EVENT_SUBSCRIBE:
        if (event->subscribe.attr_handle == sample_handle) {
            portENTER_CRITICAL(&state_lock);
            notify_enabled = event->subscribe.cur_notify != 0;
            portEXIT_CRITICAL(&state_lock);
            ESP_LOGI(TAG, "Notify %s",
                     event->subscribe.cur_notify ? "enabled" : "disabled");
        }
        return 0;

    case BLE_GAP_EVENT_ADV_COMPLETE:
        start_advertising();
        return 0;

    default:
        return 0;
    }
}

static void on_reset(int reason)
{
    ESP_LOGE(TAG, "NimBLE reset; reason=%d", reason);
}

static void on_sync(void)
{
    int rc = ble_hs_util_ensure_addr(0);
    if (rc == 0) {
        rc = ble_hs_id_infer_auto(0, &own_addr_type);
    }
    if (rc == 0) {
        start_advertising();
    } else {
        ESP_LOGE(TAG, "Cannot prepare BLE address: %d", rc);
    }
}

static void nimble_host_task(void *param)
{
    (void)param;
    nimble_port_run();
    nimble_port_freertos_deinit();
}

static void sample_task(void *param)
{
    int64_t next_regular_ms = 0;
    int64_t last_fall_notify_ms = -BLE_FALL_NOTIFY_PERIOD_MS;
    bool was_fall_confirmed = false;

    (void)param;

    while (1) {
        ble_sample_payload_t payload;
        mpu6050_snapshot_t snapshot;
        uint16_t conn;
        bool subscribed;
        const int64_t now_ms = esp_timer_get_time() / 1000LL;
        bool fall_confirmed;
        bool should_send;

        mpu6050_get_snapshot(&snapshot);
        const uint8_t state = payload_state(&snapshot);
        fall_confirmed = state == 3;
        should_send = !fall_confirmed && now_ms >= next_regular_ms;
        if (fall_confirmed &&
            ((!was_fall_confirmed) ||
             now_ms - last_fall_notify_ms >= BLE_FALL_NOTIFY_PERIOD_MS)) {
            should_send = true;
        }

        if (should_send) {
            const uint8_t hr = 60U + (esp_random() % 41U);
            const uint16_t steps = 1000U + (esp_random() % 9000U);
            const uint8_t battery = 50U + (esp_random() % 51U);

            payload.version = BLE_PAYLOAD_VERSION;
            payload.state = state;
            payload.magnitude_x100 = float_to_x100(snapshot.magnitude_g);
            payload.peak1s_x100 = float_to_x100(snapshot.peak1s_g);
            payload.heart_rate = hr;
            payload.steps = steps;
            payload.battery = battery;
            payload.reserved0 = 0;
            payload.reserved1 = 0;

            portENTER_CRITICAL(&state_lock);
            memcpy(sample_value, &payload, sizeof(payload));
            conn = connection_handle;
            subscribed = notify_enabled;
            portEXIT_CRITICAL(&state_lock);

            if (conn != BLE_HS_CONN_HANDLE_NONE && subscribed) {
                struct os_mbuf *packet = ble_hs_mbuf_from_flat(&payload,
                                                               sizeof(payload));
                int rc = packet == NULL
                             ? BLE_HS_ENOMEM
                             : ble_gatts_notify_custom(conn, sample_handle, packet);
                if (rc == 0) {
                    ESP_LOGI(TAG,
                             "SENT: st=%s |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u",
                             payload_state_name(state),
                             (double)snapshot.magnitude_g,
                             (double)snapshot.peak1s_g,
                             (unsigned)hr, (unsigned)steps, (unsigned)battery);
                } else {
                    ESP_LOGW(TAG, "Notify failed: %d", rc);
                }
            }
            if (fall_confirmed) {
                /* Alarm cadence is independent from the normal 1 Hz cadence. */
                last_fall_notify_ms = now_ms;
            }

            next_regular_ms = now_ms + BLE_SAMPLE_PERIOD_MS;
        }

        was_fall_confirmed = fall_confirmed;

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void app_main(void)
{
    esp_err_t err = nvs_flash_init();
    int rc;

    log_ble_mac();

    if (err == ESP_ERR_NVS_NO_FREE_PAGES ||
        err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    err = mpu6050_start();
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "MPU6050 disabled: %s", esp_err_to_name(err));
    }

    ESP_ERROR_CHECK(nimble_port_init());
    ble_hs_cfg.reset_cb = on_reset;
    ble_hs_cfg.sync_cb = on_sync;
    ble_svc_gap_init();
    ble_svc_gatt_init();

    rc = ble_svc_gap_device_name_set(DEVICE_NAME);
    if (rc == 0) {
        rc = ble_gatts_count_cfg(gatt_services);
    }
    if (rc == 0) {
        rc = ble_gatts_add_svcs(gatt_services);
    }
    if (rc != 0) {
        ESP_LOGE(TAG, "Cannot initialize GATT server: %d", rc);
        return;
    }

    nimble_port_freertos_init(nimble_host_task);
    if (xTaskCreate(sample_task, "band_samples", 4096, NULL, 5, NULL) != pdPASS) {
        ESP_LOGE(TAG, "Cannot create sample task");
    }
}
