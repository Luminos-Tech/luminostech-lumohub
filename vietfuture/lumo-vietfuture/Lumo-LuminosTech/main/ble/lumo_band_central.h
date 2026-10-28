#pragma once

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

typedef struct {
    bool connected;
    bool has_sample;
    bool has_diagnostic;
    uint8_t state;
    uint16_t magnitude_x100;
    uint16_t peak_x100;
    uint64_t received_at_ms;
    uint64_t diagnostic_at_ms;
    uint16_t sequence;
    uint16_t sensor_age_ms;
    int16_t accel_raw[3];
    int16_t gyro_raw[3];
} lumo_band_diagnostic_t;

esp_err_t lumo_band_central_start(void);
void lumo_band_get_diagnostic(lumo_band_diagnostic_t *snapshot);
