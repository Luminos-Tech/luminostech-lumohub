#include <errno.h>
#include <string.h>

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/hci.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/logging/log.h>

#include "lumo_band_config.h"
#include "lumo_ble.h"

LOG_MODULE_REGISTER(lumo_ble, LOG_LEVEL_INF);

#define LUMO_UUID_BYTES \
    BT_UUID_128_ENCODE(0x7c5a0001, 0x5d5a, 0x4f7b, 0x8c3a, 0x6a6d2e8f1001ULL)
#define LUMO_TX_UUID_BYTES \
    BT_UUID_128_ENCODE(0x7c5a0002, 0x5d5a, 0x4f7b, 0x8c3a, 0x6a6d2e8f1001ULL)
#define LUMO_RX_UUID_BYTES \
    BT_UUID_128_ENCODE(0x7c5a0003, 0x5d5a, 0x4f7b, 0x8c3a, 0x6a6d2e8f1001ULL)

static struct bt_conn *current_conn;
static bool tx_subscribed;

static struct bt_uuid_128 service_uuid = BT_UUID_INIT_128(LUMO_UUID_BYTES);
static struct bt_uuid_128 tx_uuid = BT_UUID_INIT_128(LUMO_TX_UUID_BYTES);
static struct bt_uuid_128 rx_uuid = BT_UUID_INIT_128(LUMO_RX_UUID_BYTES);

static ssize_t rx_write(struct bt_conn *conn,
                        const struct bt_gatt_attr *attr,
                        const void *buf,
                        uint16_t len,
                        uint16_t offset,
                        uint8_t flags)
{
    ARG_UNUSED(conn);
    ARG_UNUSED(attr);
    ARG_UNUSED(flags);

    if (offset != 0U) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }

    LOG_INF("Received %u bytes from BLE peer", len);
    LOG_HEXDUMP_INF(buf, len, "BLE peer command");
    /* TODO: Decode commands from the phone or companion hub here. */
    return len;
}

static void tx_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
    ARG_UNUSED(attr);
    tx_subscribed = (value == BT_GATT_CCC_NOTIFY);
    LOG_INF("BLE peer notifications %s", tx_subscribed ? "enabled" : "disabled");
}

BT_GATT_SERVICE_DEFINE(lumo_service,
    BT_GATT_PRIMARY_SERVICE(&service_uuid.uuid),
    BT_GATT_CHARACTERISTIC(&tx_uuid.uuid,
                           BT_GATT_CHRC_NOTIFY,
                           BT_GATT_PERM_NONE,
                           NULL, NULL, NULL),
    BT_GATT_CCC(tx_ccc_changed,
                BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),
    BT_GATT_CHARACTERISTIC(&rx_uuid.uuid,
                           BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP,
                           BT_GATT_PERM_WRITE,
                           NULL, rx_write, NULL)
);

static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, (BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR)),
    BT_DATA(BT_DATA_NAME_COMPLETE,
            CONFIG_BT_DEVICE_NAME, sizeof(CONFIG_BT_DEVICE_NAME) - 1),
    BT_DATA_BYTES(BT_DATA_UUID128_ALL, LUMO_UUID_BYTES),
};

static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("BLE connection failed (%u)", err);
        return;
    }

    current_conn = bt_conn_ref(conn);
    LOG_INF("BLE peer connected");
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    ARG_UNUSED(conn);
    LOG_INF("BLE peer disconnected (reason 0x%02x)", reason);

    if (current_conn) {
        bt_conn_unref(current_conn);
        current_conn = NULL;
    }
    tx_subscribed = false;

    (void)bt_le_adv_start(BT_LE_ADV_PARAM(BT_LE_ADV_OPT_CONN,
                                          BT_GAP_ADV_FAST_INT_MIN_2,
                                          BT_GAP_ADV_FAST_INT_MAX_2,
                                          NULL),
                          ad, ARRAY_SIZE(ad), NULL, 0);
}

BT_CONN_CB_DEFINE(lumo_conn_callbacks) = {
    .connected = connected,
    .disconnected = disconnected,
};

static void bt_ready(int err)
{
    if (err) {
        LOG_ERR("Bluetooth enable failed (%d)", err);
        return;
    }

    err = bt_le_adv_start(BT_LE_ADV_PARAM(BT_LE_ADV_OPT_CONN,
                                          BT_GAP_ADV_FAST_INT_MIN_2,
                                          BT_GAP_ADV_FAST_INT_MAX_2,
                                          NULL),
                          ad, ARRAY_SIZE(ad), NULL, 0);
    if (err) {
        LOG_ERR("Advertising start failed (%d)", err);
        return;
    }

    LOG_INF("Advertising as %s", CONFIG_BT_DEVICE_NAME);
}

int lumo_ble_init(void)
{
    return bt_enable(bt_ready);
}

int lumo_ble_notify(const uint8_t *data, size_t len)
{
    if (!current_conn || !tx_subscribed) {
        return -ENOTCONN;
    }

    return bt_gatt_notify(current_conn, &lumo_service.attrs[2], data, len);
}
