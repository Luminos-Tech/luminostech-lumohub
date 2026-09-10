#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "esp_err.h"
#include "esp_log.h"
#include "host/ble_gap.h"
#include "host/ble_gatt.h"
#include "host/ble_hs.h"
#include "host/ble_hs_adv.h"
#include "host/ble_hs_mbuf.h"
#include "host/ble_uuid.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "nvs_flash.h"
#include "os/os_mbuf.h"

#include "lumo_band_central.h"

#define TARGET_NAME "LUMO-TEST-C3"
#define SAMPLE_SIZE 12U
#define BLE_PAYLOAD_VERSION 0x02U

static const char *TAG = "BAND_BLE";

/* NimBLE stores UUID bytes least-significant first. */
static const ble_uuid128_t target_service_uuid = BLE_UUID128_INIT(
    0xf0, 0xde, 0xbc, 0x9a, 0x78, 0x56, 0x34, 0x12,
    0x78, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12);
static const ble_uuid128_t target_sample_uuid = BLE_UUID128_INIT(
    0xf1, 0xde, 0xbc, 0x9a, 0x78, 0x56, 0x34, 0x12,
    0x78, 0x56, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12);

static uint8_t own_addr_type;
static ble_addr_t target_addr;
static bool target_pending;
static bool scanning;
static bool connecting;
static bool service_found;
static bool characteristic_found;
static bool cccd_found;
static uint16_t connection_handle = BLE_HS_CONN_HANDLE_NONE;
static uint16_t service_start_handle;
static uint16_t service_end_handle;
static uint16_t sample_handle;
static uint16_t cccd_handle;

static int gap_event(struct ble_gap_event *event, void *arg);
static void restart_scan(void);

static uint16_t read_u16_le(const uint8_t *src)
{
    return (uint16_t)src[0] | ((uint16_t)src[1] << 8);
}

static void log_address(const char *label, const ble_addr_t *addr)
{
    ESP_LOGI(TAG, "%s %02X:%02X:%02X:%02X:%02X:%02X",
             label,
             addr->val[5], addr->val[4], addr->val[3],
             addr->val[2], addr->val[1], addr->val[0]);
}

static void fail_connection(const char *stage)
{
    ESP_LOGE(TAG, "%s failed", stage);
    if (connection_handle != BLE_HS_CONN_HANDLE_NONE) {
        (void)ble_gap_terminate(connection_handle, BLE_ERR_REM_USER_CONN_TERM);
    } else {
        connecting = false;
        restart_scan();
    }
}

static int subscription_written(uint16_t conn_handle,
                                const struct ble_gatt_error *error,
                                struct ble_gatt_attr *attr,
                                void *arg)
{
    (void)conn_handle;
    (void)attr;
    (void)arg;

    if (error->status == 0) {
        ESP_LOGI(TAG, "Notify subscribed; waiting for samples");
        return 0;
    }

    fail_connection("Notification subscription");
    return error->status;
}

static int descriptor_discovered(uint16_t conn_handle,
                                 const struct ble_gatt_error *error,
                                 uint16_t chr_val_handle,
                                 const struct ble_gatt_dsc *descriptor,
                                 void *arg)
{
    uint8_t enable_notify[2] = {1, 0};
    int rc;

    (void)chr_val_handle;
    (void)arg;

    if (error->status == 0 && descriptor != NULL) {
        if (cccd_found ||
            ble_uuid_cmp(&descriptor->uuid.u,
                         BLE_UUID16_DECLARE(BLE_GATT_DSC_CLT_CFG_UUID16)) != 0) {
            return 0;
        }

        cccd_found = true;
        cccd_handle = descriptor->handle;
        return 0;
    }

    if (error->status == BLE_HS_EDONE) {
        if (!cccd_found) {
            fail_connection("CCCD discovery");
            return BLE_HS_ENOENT;
        }

        ESP_LOGI(TAG, "CCCD found; subscribing");
        rc = ble_gattc_write_flat(conn_handle,
                                  cccd_handle,
                                  enable_notify,
                                  sizeof(enable_notify),
                                  subscription_written,
                                  NULL);
        if (rc != 0) {
            fail_connection("Notification subscription");
        }
        return rc;
    }

    fail_connection("CCCD discovery");
    return error->status;
}

static int characteristic_discovered(uint16_t conn_handle,
                                     const struct ble_gatt_error *error,
                                     const struct ble_gatt_chr *characteristic,
                                     void *arg)
{
    int rc;

    (void)arg;

    if (error->status == 0 && characteristic != NULL) {
        if (characteristic_found) {
            return 0;
        }
        if ((characteristic->properties & BLE_GATT_CHR_PROP_NOTIFY) == 0) {
            fail_connection("Characteristic has no NOTIFY property");
            return BLE_HS_ENOTSUP;
        }

        characteristic_found = true;
        sample_handle = characteristic->val_handle;
        return 0;
    }

    if (error->status == BLE_HS_EDONE) {
        if (!characteristic_found) {
            fail_connection("Characteristic discovery");
            return BLE_HS_ENOENT;
        }

        ESP_LOGI(TAG, "Characteristic found; handle=%u", sample_handle);
        rc = ble_gattc_disc_all_dscs(conn_handle,
                                     sample_handle,
                                     service_end_handle,
                                     descriptor_discovered,
                                     NULL);
        if (rc != 0) {
            fail_connection("CCCD discovery");
        }
        return rc;
    }

    fail_connection("Characteristic discovery");
    return error->status;
}

static int service_discovered(uint16_t conn_handle,
                              const struct ble_gatt_error *error,
                              const struct ble_gatt_svc *service,
                              void *arg)
{
    int rc;

    (void)arg;

    if (error->status == 0 && service != NULL) {
        if (service_found) {
            return 0;
        }

        service_found = true;
        service_start_handle = service->start_handle;
        service_end_handle = service->end_handle;
        return 0;
    }

    if (error->status == BLE_HS_EDONE) {
        if (!service_found) {
            fail_connection("Service discovery");
            return BLE_HS_ENOENT;
        }

        ESP_LOGI(TAG, "Service found; discovering characteristic");
        rc = ble_gattc_disc_chrs_by_uuid(conn_handle,
                                         service_start_handle,
                                         service_end_handle,
                                         &target_sample_uuid.u,
                                         characteristic_discovered,
                                         NULL);
        if (rc != 0) {
            fail_connection("Characteristic discovery");
        }
        return rc;
    }

    fail_connection("Service discovery");
    return error->status;
}

static void connect_to_target(void)
{
    int rc;

    if (!target_pending || connecting ||
        connection_handle != BLE_HS_CONN_HANDLE_NONE) {
        return;
    }

    target_pending = false;
    connecting = true;
    log_address("Connecting to", &target_addr);
    rc = ble_gap_connect(own_addr_type, &target_addr, 30000,
                         NULL, gap_event, NULL);
    if (rc != 0) {
        ESP_LOGE(TAG, "Cannot connect: %d", rc);
        connecting = false;
        restart_scan();
    }
}

static void restart_scan(void)
{
    struct ble_gap_disc_params params = {0};
    int rc;

    if (scanning || connecting || connection_handle != BLE_HS_CONN_HANDLE_NONE) {
        return;
    }

    target_pending = false;
    params.passive = 0;
    params.filter_duplicates = 0;
    params.itvl = 0x0010;
    params.window = 0x0010;

    ESP_LOGI(TAG, "Scanning for %s...", TARGET_NAME);
    rc = ble_gap_disc(own_addr_type, BLE_HS_FOREVER,
                      &params, gap_event, NULL);
    if (rc == 0) {
        scanning = true;
    } else {
        ESP_LOGE(TAG, "Cannot start scan: %d", rc);
    }
}

static int gap_event(struct ble_gap_event *event, void *arg)
{
    struct ble_hs_adv_fields fields = {0};
    uint8_t payload[SAMPLE_SIZE];
    uint16_t length;
    int rc;

    (void)arg;

    switch (event->type) {
    case BLE_GAP_EVENT_DISC:
        if (!scanning || target_pending || connecting ||
            connection_handle != BLE_HS_CONN_HANDLE_NONE) {
            return 0;
        }

        rc = ble_hs_adv_parse_fields(&fields,
                                     event->disc.data,
                                     event->disc.length_data);
        if (rc != 0 || fields.name == NULL ||
            fields.name_len != strlen(TARGET_NAME) ||
            memcmp(fields.name, TARGET_NAME, fields.name_len) != 0) {
            return 0;
        }

        memcpy(&target_addr, &event->disc.addr, sizeof(target_addr));
        target_pending = true;
        log_address("Found LUMO-TEST-C3 at", &target_addr);
        rc = ble_gap_disc_cancel();
        if (rc != 0) {
            target_pending = false;
            ESP_LOGE(TAG, "Cannot stop scan: %d", rc);
        } else {
            /* NimBLE does not emit DISC_COMPLETE after an explicit cancel. */
            scanning = false;
            connect_to_target();
        }
        return 0;

    case BLE_GAP_EVENT_DISC_COMPLETE:
        scanning = false;
        if (target_pending) {
            connect_to_target();
        } else {
            restart_scan();
        }
        return 0;

    case BLE_GAP_EVENT_CONNECT:
        connecting = false;
        if (event->connect.status != 0) {
            ESP_LOGW(TAG, "Connection failed: %d", event->connect.status);
            restart_scan();
            return 0;
        }

        connection_handle = event->connect.conn_handle;
        service_found = false;
        characteristic_found = false;
        cccd_found = false;
        ESP_LOGI(TAG, "Connected; discovering service");
        rc = ble_gattc_disc_svc_by_uuid(connection_handle,
                                         &target_service_uuid.u,
                                         service_discovered,
                                         NULL);
        if (rc != 0) {
            fail_connection("Service discovery");
        }
        return 0;

    case BLE_GAP_EVENT_DISCONNECT:
        ESP_LOGI(TAG, "Disconnected, rescanning...");
        connection_handle = BLE_HS_CONN_HANDLE_NONE;
        connecting = false;
        service_found = false;
        characteristic_found = false;
        cccd_found = false;
        restart_scan();
        return 0;

    case BLE_GAP_EVENT_NOTIFY_RX:
        if (event->notify_rx.attr_handle != sample_handle) {
            return 0;
        }

        length = (uint16_t)OS_MBUF_PKTLEN(event->notify_rx.om);
        if (length != SAMPLE_SIZE) {
            ESP_LOGW(TAG, "Unexpected notify length: %u", length);
            return 0;
        }

        rc = os_mbuf_copydata(event->notify_rx.om, 0,
                              sizeof(payload), payload);
        if (rc == 0) {
            const uint8_t version = payload[0];
            const uint8_t state = payload[1];
            const uint16_t magnitude_x100 = read_u16_le(&payload[2]);
            const uint16_t peak1s_x100 = read_u16_le(&payload[4]);
            const uint8_t heart_rate = payload[6];
            const uint16_t steps = read_u16_le(&payload[7]);
            const uint8_t battery = payload[9];

            /* ============================================================
             * TODO: Thêm logic xử lý khi peak >= 6g
             * - Biến: peak1s_x100 (peak × 100)
             * - Điều kiện: peak1s_x100 >= 600  (tương đương 6g)
             * - Các biến đã parse:
             *   - state       (payload[1])
             *   - magnitude_x100 (payload[2-3])
             *   - peak1s_x100 (payload[4-5])
             *   - heart_rate (payload[6])
             *   - steps       (payload[7-8])
             *   - battery     (payload[9])
             * ============================================================ */
            if (peak1s_x100 >= 600) {
                /* TODO: Thêm logic xử lý ở đây
                 * Ví dụ:
                 *   - Gửi cảnh báo ngã
                 *   - Bật loa thông báo
                 *   - Gửi notification lên server
                 */
            }

            if (version != BLE_PAYLOAD_VERSION) {
                ESP_LOGW(TAG, "Unsupported BLE payload version: 0x%02X",
                         version);
                return 0;
            }

            /* Log level theo mức nghiêm trọng của state */
            switch (state) {
            case 0: /* IDLE — bình thường */
                ESP_LOGI(TAG,
                         "RECV: v=%u st=IDLE      |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u",
                         (unsigned)version,
                         (double)magnitude_x100 / 100.0,
                         (double)peak1s_x100 / 100.0,
                         (unsigned)heart_rate,
                         (unsigned)steps,
                         (unsigned)battery);
                break;
            case 1: /* MOVE — bình thường */
                ESP_LOGI(TAG,
                         "RECV: v=%u st=MOVE      |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u",
                         (unsigned)version,
                         (double)magnitude_x100 / 100.0,
                         (double)peak1s_x100 / 100.0,
                         (unsigned)heart_rate,
                         (unsigned)steps,
                         (unsigned)battery);
                break;
            case 2: /* IMPACT_WAIT — cảnh báo: có thể ngã */
                ESP_LOGW(TAG,
                         "RECV: v=%u st=IMPACT_WAIT |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u  ⚠️ CHECKING FALL",
                         (unsigned)version,
                         (double)magnitude_x100 / 100.0,
                         (double)peak1s_x100 / 100.0,
                         (unsigned)heart_rate,
                         (unsigned)steps,
                         (unsigned)battery);
                break;
            case 3: /* FALL_CONFIRMED — nguy hiểm: ngã đã xác nhận */
                ESP_LOGE(TAG,
                         "RECV: v=%u st=FALL_CONFIRMED |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u  🚨 FALL DETECTED!",
                         (unsigned)version,
                         (double)magnitude_x100 / 100.0,
                         (double)peak1s_x100 / 100.0,
                         (unsigned)heart_rate,
                         (unsigned)steps,
                         (unsigned)battery);
                break;
            case 4: /* SENSOR_OFFLINE — cảnh báo: mất kết nối wearable */
                ESP_LOGW(TAG,
                         "RECV: v=%u st=SENSOR_OFFLINE |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u  ⚠️ WEARABLE DISCONNECTED",
                         (unsigned)version,
                         (double)magnitude_x100 / 100.0,
                         (double)peak1s_x100 / 100.0,
                         (unsigned)heart_rate,
                         (unsigned)steps,
                         (unsigned)battery);
                break;
            default:
                ESP_LOGW(TAG,
                         "RECV: v=%u st=UNKNOWN(0x%02X) |a|=%.2fg peak=%.2fg hr=%u steps=%u bat=%u",
                         (unsigned)version,
                         (unsigned)state,
                         (double)magnitude_x100 / 100.0,
                         (double)peak1s_x100 / 100.0,
                         (unsigned)heart_rate,
                         (unsigned)steps,
                         (unsigned)battery);
                break;
            }
        } else {
            ESP_LOGW(TAG, "Cannot copy notification: %d", rc);
        }
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
        restart_scan();
    } else {
        ESP_LOGE(TAG, "Cannot prepare local BLE address: %d", rc);
    }
}

static void host_task(void *param)
{
    (void)param;
    nimble_port_run();
    nimble_port_freertos_deinit();
}

esp_err_t lumo_band_central_start(void)
{
    esp_err_t err = nvs_flash_init();

    if (err == ESP_ERR_NVS_NO_FREE_PAGES ||
        err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        err = nvs_flash_erase();
        if (err == ESP_OK) {
            err = nvs_flash_init();
        }
    }
    if (err != ESP_OK) {
        return err;
    }

    err = nimble_port_init();
    if (err != ESP_OK) {
        return err;
    }

    ble_hs_cfg.reset_cb = on_reset;
    ble_hs_cfg.sync_cb = on_sync;
    nimble_port_freertos_init(host_task);
    ESP_LOGI(TAG, "ESP32-S3 BLE central started");
    return ESP_OK;
}
