#pragma once

#include <stdbool.h>

#include "esp_err.h"

typedef enum {
    STATE_IDLE = 0,
    STATE_IMPACT_WAIT,
    STATE_FALL_CONFIRMED,
    STATE_RECOVERED,
    STATE_SENSOR_OFFLINE,
} fall_state_t;

extern volatile fall_state_t g_fall_state;

typedef struct {
    fall_state_t state;
    float magnitude_g;
    float peak1s_g;
    bool moving;
    bool sensor_online;
} mpu6050_snapshot_t;

esp_err_t mpu6050_start(void);
void mpu6050_get_snapshot(mpu6050_snapshot_t *snapshot);
void force_impact_for_test(void);
void on_fall_critical(void);
