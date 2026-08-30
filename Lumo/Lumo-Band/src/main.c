#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

#include "esp32_link.h"
#include "lumo_ble.h"

LOG_MODULE_REGISTER(lumo_band, LOG_LEVEL_INF);

int main(void)
{
    int err;

    LOG_INF("Lumo-band starting");

    err = lumo_ble_init();
    if (err) {
        LOG_ERR("BLE initialization failed (%d)", err);
        return err;
    }

    err = lumo_esp32_link_init();
    if (err) {
        LOG_ERR("BLE peer link initialization failed (%d)", err);
        return err;
    }

    LOG_INF("Lumo-band ready");
    while (1) {
        k_sleep(K_SECONDS(5));
    }

    return 0;
}
