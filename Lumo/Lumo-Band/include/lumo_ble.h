#ifndef LUMO_BLE_H
#define LUMO_BLE_H

#include <stddef.h>
#include <stdint.h>

int lumo_ble_init(void);
int lumo_ble_notify(const uint8_t *data, size_t len);

#endif /* LUMO_BLE_H */
