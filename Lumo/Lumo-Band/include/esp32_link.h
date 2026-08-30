#ifndef ESP32_LINK_H
#define ESP32_LINK_H

#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

esp_err_t lumo_esp32_link_init(void);
esp_err_t lumo_esp32_link_send(const uint8_t *data, size_t len);

#endif /* ESP32_LINK_H */
