#include "mpu6050.h"

#include <stdbool.h>
#include <math.h>
#include <stddef.h>
#include <stdint.h>

#include "driver/i2c_master.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define MPU6050_I2C_PORT I2C_NUM_0
#define MPU6050_SDA_GPIO 3
#define MPU6050_SCL_GPIO 4
#define MPU6050_I2C_ADDRESS 0x68
#define MPU6050_I2C_SPEED_HZ 400000
#define MPU6050_I2C_TIMEOUT_MS 100
#define MPU6050_SAMPLE_PERIOD_MS 100
#define MPU6050_PEAK_WINDOW_SAMPLES 10

#define FALL_IMPACT_G 4.0f
#define MOVE_G 1.5f
#define MOVE_DPS 50.0f
#define STILL_G_LOW 0.85f
#define STILL_G_HIGH 1.15f
#define STILL_GYRO_DPS 10.0f
#define RECOVERY_WINDOW_MS 10000
#define STILL_REQUIRED_MS 5000
#define MOVE_SAMPLES_TO_RECOVER 3
#define MOVE_SAMPLES_TO_CLEAR_ALARM 5
#define ALARM_LOG_PERIOD_MS 5000

#define MPU6050_REG_ACCEL_XOUT_H 0x3B
#define MPU6050_REG_GYRO_CONFIG 0x1B
#define MPU6050_REG_ACCEL_CONFIG 0x1C
#define MPU6050_REG_PWR_MGMT_1 0x6B
#define MPU6050_REG_WHO_AM_I 0x75
#define MPU6050_WHO_AM_I_VALUE 0x68

#define MPU6050_ACCEL_CONFIG_8G 0x10
#define MPU6050_ACCEL_LSB_PER_G 4096.0f
#define MPU6050_GYRO_LSB_PER_DPS 131.0f

static const char *TAG = "mpu6050";
static i2c_master_bus_handle_t s_i2c_bus;
static i2c_master_dev_handle_t s_mpu6050;
volatile fall_state_t g_fall_state = STATE_IDLE;
static portMUX_TYPE s_state_lock = portMUX_INITIALIZER_UNLOCKED;
static float s_magnitude_g;
static float s_peak1s_g;
static bool s_moving;
static bool s_sensor_online;
static float s_accel_window[MPU6050_PEAK_WINDOW_SAMPLES];
static uint8_t s_accel_window_index;
static uint8_t s_accel_window_count;
static int64_t s_time_impact_ms;
static int64_t s_last_alarm_log_ms;
static uint32_t s_counter_still_ms;
static uint32_t s_next_still_log_ms = 1000;
static uint8_t s_move_samples;

static const char *fall_state_name(fall_state_t state)
{
    switch (state) {
    case STATE_IDLE:
        return "IDLE";
    case STATE_IMPACT_WAIT:
        return "IMPACT_WAIT";
    case STATE_FALL_CONFIRMED:
        return "FALL_CONFIRMED";
    case STATE_RECOVERED:
        return "RECOVERED";
    case STATE_SENSOR_OFFLINE:
        return "SENSOR_OFFLINE";
    default:
        return "UNKNOWN";
    }
}

static float vector_magnitude(float x, float y, float z)
{
    return sqrtf((x * x) + (y * y) + (z * z));
}

static void reset_fall_tracking(void)
{
    s_time_impact_ms = 0;
    s_last_alarm_log_ms = 0;
    s_counter_still_ms = 0;
    s_next_still_log_ms = 1000;
    s_move_samples = 0;
}

static void publish_snapshot(float magnitude_g, float peak1s_g,
                             bool moving, bool sensor_online)
{
    portENTER_CRITICAL(&s_state_lock);
    s_magnitude_g = magnitude_g;
    s_peak1s_g = peak1s_g;
    s_moving = moving;
    s_sensor_online = sensor_online;
    portEXIT_CRITICAL(&s_state_lock);
}

static void mark_sensor_offline(void)
{
    portENTER_CRITICAL(&s_state_lock);
    g_fall_state = STATE_SENSOR_OFFLINE;
    s_peak1s_g = 0.0f;
    s_accel_window_index = 0;
    s_accel_window_count = 0;
    portEXIT_CRITICAL(&s_state_lock);
    publish_snapshot(0.0f, 0.0f, false, false);
}

void mpu6050_get_snapshot(mpu6050_snapshot_t *snapshot)
{
    if (snapshot == NULL) {
        return;
    }

    portENTER_CRITICAL(&s_state_lock);
    snapshot->state = g_fall_state;
    snapshot->magnitude_g = s_magnitude_g;
    snapshot->peak1s_g = s_peak1s_g;
    snapshot->moving = s_moving;
    snapshot->sensor_online = s_sensor_online;
    portEXIT_CRITICAL(&s_state_lock);
}

static void enter_impact_wait(int64_t now_ms)
{
    reset_fall_tracking();
    s_time_impact_ms = now_ms;
    g_fall_state = STATE_IMPACT_WAIT;
    ESP_LOGW(TAG, "IMPACT detected, watching for recovery...");
}

static void log_fall_alarm(int64_t now_ms)
{
    const int seconds_since_impact =
        (int)((now_ms - s_time_impact_ms) / 1000LL);

    ESP_LOGE(TAG,
             "!!! CRITICAL: FALL + NO MOTION detected, still for %d s "
             "since impact !!!",
             seconds_since_impact);
}

void __attribute__((weak)) on_fall_critical(void)
{
    /* TODO: gui BLE notify 'FALL' qua characteristic hien tai. */
}

void force_impact_for_test(void)
{
    portENTER_CRITICAL(&s_state_lock);
    enter_impact_wait(esp_timer_get_time() / 1000LL);
    portEXIT_CRITICAL(&s_state_lock);
}

static void update_fall_state(float accel_magnitude_g,
                              float gyro_magnitude_dps,
                              int64_t now_ms)
{
    const bool moving = accel_magnitude_g > MOVE_G ||
                        gyro_magnitude_dps > MOVE_DPS;
    const bool still = accel_magnitude_g >= STILL_G_LOW &&
                       accel_magnitude_g <= STILL_G_HIGH &&
                       gyro_magnitude_dps < STILL_GYRO_DPS;

    switch (g_fall_state) {
    case STATE_IDLE:
        if (accel_magnitude_g >= FALL_IMPACT_G) {
            enter_impact_wait(now_ms);
        }
        break;

    case STATE_IMPACT_WAIT:
        if (moving) {
            s_counter_still_ms = 0;
            s_next_still_log_ms = 1000;
            if (s_move_samples < UINT8_MAX) {
                ++s_move_samples;
            }
            if (s_move_samples >= MOVE_SAMPLES_TO_RECOVER) {
                g_fall_state = STATE_RECOVERED;
                ESP_LOGW(TAG, "Motion after impact, marking RECOVERED");
            }
        } else {
            s_move_samples = 0;
            if (still) {
                s_counter_still_ms += MPU6050_SAMPLE_PERIOD_MS;
                if (s_counter_still_ms >= s_next_still_log_ms) {
                    ESP_LOGI(TAG, "STILL %d ms", (int)s_counter_still_ms);
                    s_next_still_log_ms += 1000;
                }
                if (s_counter_still_ms >= STILL_REQUIRED_MS) {
                    g_fall_state = STATE_FALL_CONFIRMED;
                    s_move_samples = 0;
                    s_last_alarm_log_ms = now_ms;
                    log_fall_alarm(now_ms);
                    on_fall_critical();
                }
            } else {
                s_counter_still_ms = 0;
                s_next_still_log_ms = 1000;
            }
        }

        if (g_fall_state == STATE_IMPACT_WAIT &&
            now_ms - s_time_impact_ms >= RECOVERY_WINDOW_MS) {
            g_fall_state = STATE_IDLE;
            reset_fall_tracking();
            ESP_LOGW(TAG, "impact unresolved, timeout");
        }
        break;

    case STATE_FALL_CONFIRMED:
        if (moving) {
            if (s_move_samples < UINT8_MAX) {
                ++s_move_samples;
            }
            if (s_move_samples >= MOVE_SAMPLES_TO_CLEAR_ALARM) {
                g_fall_state = STATE_IDLE;
                reset_fall_tracking();
                ESP_LOGW(TAG, "ALARM CLEARED by motion");
                break;
            }
        } else {
            s_move_samples = 0;
        }

        if (now_ms - s_last_alarm_log_ms >= ALARM_LOG_PERIOD_MS) {
            log_fall_alarm(now_ms);
            s_last_alarm_log_ms = now_ms;
        }
        break;

    case STATE_RECOVERED:
        g_fall_state = STATE_IDLE;
        reset_fall_tracking();
        break;

    default:
        g_fall_state = STATE_IDLE;
        reset_fall_tracking();
        break;
    }
}

static esp_err_t write_register(uint8_t register_address, uint8_t value)
{
    const uint8_t data[2] = {register_address, value};

    return i2c_master_transmit(s_mpu6050, data, sizeof(data),
                               MPU6050_I2C_TIMEOUT_MS);
}

static esp_err_t read_registers(uint8_t register_address,
                                uint8_t *data,
                                size_t data_size)
{
    return i2c_master_transmit_receive(s_mpu6050,
                                       &register_address,
                                       sizeof(register_address),
                                       data,
                                       data_size,
                                       MPU6050_I2C_TIMEOUT_MS);
}

static int16_t read_i16_be(const uint8_t *data)
{
    return (int16_t)(((uint16_t)data[0] << 8) | (uint16_t)data[1]);
}

static void scan_mpu_addresses(void)
{
    static const uint8_t addresses[] = {0x68, 0x69};

    for (size_t i = 0; i < sizeof(addresses); ++i) {
        esp_err_t err = i2c_master_probe(s_i2c_bus, addresses[i],
                                         MPU6050_I2C_TIMEOUT_MS);
        if (err == ESP_OK) {
            ESP_LOGI(TAG, "I2C scan 0x%02X: ACK", addresses[i]);
        } else if (err == ESP_ERR_NOT_FOUND) {
            ESP_LOGI(TAG, "I2C scan 0x%02X: no ACK", addresses[i]);
        } else {
            ESP_LOGW(TAG, "I2C scan 0x%02X: %s", addresses[i],
                     esp_err_to_name(err));
        }
    }
}

static void release_i2c(void)
{
    if (s_mpu6050 != NULL) {
        (void)i2c_master_bus_rm_device(s_mpu6050);
        s_mpu6050 = NULL;
    }
    if (s_i2c_bus != NULL) {
        (void)i2c_del_master_bus(s_i2c_bus);
        s_i2c_bus = NULL;
    }
}

static void mpu6050_task(void *param)
{
    TickType_t next_wake = xTaskGetTickCount();

    (void)param;

    while (true) {
        uint8_t raw[14];
        esp_err_t err = read_registers(MPU6050_REG_ACCEL_XOUT_H,
                                       raw, sizeof(raw));

        if (err == ESP_OK) {
            const int16_t accel_x_raw = read_i16_be(&raw[0]);
            const int16_t accel_y_raw = read_i16_be(&raw[2]);
            const int16_t accel_z_raw = read_i16_be(&raw[4]);
            const int16_t gyro_x_raw = read_i16_be(&raw[8]);
            const int16_t gyro_y_raw = read_i16_be(&raw[10]);
            const int16_t gyro_z_raw = read_i16_be(&raw[12]);
            const float accel_x = (float)accel_x_raw / MPU6050_ACCEL_LSB_PER_G;
            const float accel_y = (float)accel_y_raw / MPU6050_ACCEL_LSB_PER_G;
            const float accel_z = (float)accel_z_raw / MPU6050_ACCEL_LSB_PER_G;
            const float gyro_x = (float)gyro_x_raw / MPU6050_GYRO_LSB_PER_DPS;
            const float gyro_y = (float)gyro_y_raw / MPU6050_GYRO_LSB_PER_DPS;
            const float gyro_z = (float)gyro_z_raw / MPU6050_GYRO_LSB_PER_DPS;
            const long long timestamp_ms =
                (long long)(esp_timer_get_time() / 1000LL);
            const float accel_magnitude =
                vector_magnitude(accel_x, accel_y, accel_z);
            const float gyro_magnitude =
                vector_magnitude(gyro_x, gyro_y, gyro_z);
            const bool moving = accel_magnitude > MOVE_G ||
                                gyro_magnitude > MOVE_DPS;
            float peak1s_g;

            portENTER_CRITICAL(&s_state_lock);
            s_accel_window[s_accel_window_index] = accel_magnitude;
            s_accel_window_index =
                (s_accel_window_index + 1) % MPU6050_PEAK_WINDOW_SAMPLES;
            if (s_accel_window_count < MPU6050_PEAK_WINDOW_SAMPLES) {
                ++s_accel_window_count;
            }
            s_peak1s_g = 0.0f;
            for (uint8_t i = 0; i < s_accel_window_count; ++i) {
                if (s_accel_window[i] > s_peak1s_g) {
                    s_peak1s_g = s_accel_window[i];
                }
            }
            peak1s_g = s_peak1s_g;
            portEXIT_CRITICAL(&s_state_lock);

            update_fall_state(accel_magnitude, gyro_magnitude,
                              (int64_t)timestamp_ms);
            publish_snapshot(accel_magnitude, peak1s_g, moving, true);

            ESP_LOGI(TAG,
                     "MPU ax=%6.2fg ay=%6.2fg az=%6.2fg "
                     "gx=%7.2f gy=%7.2f gz=%7.2f "
                     "|a|=%5.2fg |gyro|=%7.2fdps t=%lld ms state=%s",
                     (double)accel_x, (double)accel_y, (double)accel_z,
                     (double)gyro_x, (double)gyro_y, (double)gyro_z,
                     (double)accel_magnitude, (double)gyro_magnitude,
                     timestamp_ms, fall_state_name(g_fall_state));
        } else {
            mark_sensor_offline();
            ESP_LOGW(TAG, "MPU6050 read failed: %s", esp_err_to_name(err));
        }

        vTaskDelayUntil(&next_wake, pdMS_TO_TICKS(MPU6050_SAMPLE_PERIOD_MS));
    }
}

esp_err_t mpu6050_start(void)
{
    const i2c_master_bus_config_t bus_config = {
        .i2c_port = MPU6050_I2C_PORT,
        .sda_io_num = MPU6050_SDA_GPIO,
        .scl_io_num = MPU6050_SCL_GPIO,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    const i2c_device_config_t device_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = MPU6050_I2C_ADDRESS,
        .scl_speed_hz = MPU6050_I2C_SPEED_HZ,
    };
    uint8_t who_am_i = 0;
    esp_err_t err;

    err = i2c_new_master_bus(&bus_config, &s_i2c_bus);
    if (err != ESP_OK) {
        mark_sensor_offline();
        ESP_LOGE(TAG, "Cannot create I2C bus: %s", esp_err_to_name(err));
        return err;
    }

    err = i2c_master_bus_add_device(s_i2c_bus, &device_config, &s_mpu6050);
    if (err != ESP_OK) {
        mark_sensor_offline();
        ESP_LOGE(TAG, "Cannot add MPU6050: %s", esp_err_to_name(err));
        release_i2c();
        return err;
    }

    /* Wake the sensor and clear all PWR_MGMT_1 control bits. */
    err = write_register(MPU6050_REG_PWR_MGMT_1, 0x00);
    if (err == ESP_OK) {
        vTaskDelay(pdMS_TO_TICKS(100));
        err = read_registers(MPU6050_REG_WHO_AM_I, &who_am_i,
                             sizeof(who_am_i));
    }

    if (err != ESP_OK || who_am_i != MPU6050_WHO_AM_I_VALUE) {
        mark_sensor_offline();
        if (err == ESP_OK) {
            ESP_LOGE(TAG, "MPU6050 not found: WHO_AM_I=0x%02X", who_am_i);
            err = ESP_ERR_NOT_FOUND;
        } else {
            ESP_LOGE(TAG, "MPU6050 not found: %s", esp_err_to_name(err));
        }
        scan_mpu_addresses();
        release_i2c();
        return err;
    }

    err = write_register(MPU6050_REG_GYRO_CONFIG, 0x00);
    if (err == ESP_OK) {
        err = write_register(MPU6050_REG_ACCEL_CONFIG,
                             MPU6050_ACCEL_CONFIG_8G);
    }
    if (err != ESP_OK) {
        mark_sensor_offline();
        ESP_LOGE(TAG, "MPU6050 configuration failed: %s",
                 esp_err_to_name(err));
        release_i2c();
        return err;
    }

    ESP_LOGI(TAG, "MPU6050 ready: WHO_AM_I=0x%02X, SDA=%d, SCL=%d",
             who_am_i, MPU6050_SDA_GPIO, MPU6050_SCL_GPIO);

    /* TODO: Use calibrated acceleration to estimate steps for BLE samples. */
    if (xTaskCreate(mpu6050_task, "mpu6050", 3072, NULL, 5, NULL) != pdPASS) {
        mark_sensor_offline();
        ESP_LOGE(TAG, "Cannot create MPU6050 task");
        release_i2c();
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}
