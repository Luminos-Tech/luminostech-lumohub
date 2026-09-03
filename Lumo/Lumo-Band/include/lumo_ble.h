#ifndef LUMO_BLE_H
#define LUMO_BLE_H

#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

esp_err_t lumo_ble_init(void);
esp_err_t lumo_ble_notify(const uint8_t *data, size_t len);

#endif /* LUMO_BLE_H */
