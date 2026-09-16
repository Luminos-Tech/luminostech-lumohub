/**
 * @file lumo_band_state.c
 * @brief Shared state + alert logic for LumoBand BLE sensor data.
 *
 * Defines the global `g_band_state` shared between:
 *   - BLE NimBLE host task  (writes sensor values)
 *   - main app_main task   (reads & acts on alerts)
 *
 * Design notes:
 *   - Simple int/bool fields are safe to read without mutex on ESP32
 *     (aligned 32-bit reads are atomic).
 *   - The 64-bit timestamp uses esp_timer_get_time() which is monotonic
 *     and safe to read from any task.
 *   - Alert cooldown prevents audio spam.
 */

#include "lumo_band_state.h"

#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "band_state";
#include "freertos/task.h"

/* ========================================================================
 * Global shared state — written only by BLE task, read by main task
 * ======================================================================== */
volatile lumo_band_shared_t g_band_state = {
    .state                        = BAND_STATE_IDLE,
    .heart_rate                   = 0,
    .steps                        = 0,
    .battery                      = 0,
    .magnitude_x100               = 0,
    .peak_x100                    = 0,
    .last_update_ms               = 0,
    .last_alert                   = BAND_ALERT_NONE,
    .last_alert_sev               = BAND_SEVERITY_INFO,
    .last_alert_ms                = 0,
    .fall_alert_active            = false,
    .fall_alert_acknowledged      = false,
    .fall_confirmed_ms            = 0,
    .high_hr_count               = 0,
    .low_hr_count                = 0,
    .high_impact_count            = 0,
    .steps_goal_reached           = false,
    .prev_steps                   = 0,
};

/* ========================================================================
 * String helpers
 * ======================================================================== */
static const char *s_state_str[] = {
    [BAND_STATE_IDLE]           = "IDLE",
    [BAND_STATE_MOVE]           = "MOVE",
    [BAND_STATE_IMPACT_WAIT]    = "IMPACT_WAIT",
    [BAND_STATE_FALL_CONFIRMED] = "FALL_CONFIRMED",
    [BAND_STATE_SENSOR_OFFLINE] = "SENSOR_OFFLINE",
};

static const char *s_alert_str[] = {
    [BAND_ALERT_NONE]             = "NONE",
    [BAND_ALERT_STEPS_GOAL]       = "STEPS_GOAL",
    [BAND_ALERT_HIGH_HEART_RATE]  = "HIGH_HR",
    [BAND_ALERT_LOW_HEART_RATE]   = "LOW_HR",
    [BAND_ALERT_FALL_SUSPECT]     = "FALL_SUSPECT",
    [BAND_ALERT_FALL_CONFIRMED]   = "FALL_CONFIRMED",
    [BAND_ALERT_HIGH_ACTIVITY]    = "HIGH_ACTIVITY",
    [BAND_ALERT_BATTERY_LOW]      = "BATTERY_LOW",
    [BAND_ALERT_BATTERY_CRITICAL] = "BATTERY_CRITICAL",
    [BAND_ALERT_SENSOR_OFFLINE]   = "SENSOR_OFFLINE",
    [BAND_ALERT_FALL_CANCELLED]   = "FALL_CANCELLED",
};

const char *band_alert_type_str(band_alert_type_t type)
{
    if (type < BAND_ALERT__MAX) {
        return s_alert_str[type];
    }
    return "UNKNOWN";
}

const char *band_state_str(band_state_t state)
{
    if (state <= BAND_STATE_SENSOR_OFFLINE) {
        return s_state_str[state];
    }
    return "UNKNOWN";
}

/* ========================================================================
 * band_state_update — called from BLE NimBLE host task
 * ======================================================================== */
void band_state_update(uint8_t  state,
                       uint8_t  heart_rate,
                       uint16_t steps,
                       uint8_t  battery,
                       uint16_t magnitude_x100,
                       uint16_t peak_x100)
{
    const uint64_t now_ms = esp_timer_get_time() / 1000ULL;

    g_band_state.state              = (band_state_t)state;
    g_band_state.heart_rate         = heart_rate;
    g_band_state.magnitude_x100     = magnitude_x100;
    g_band_state.peak_x100          = peak_x100;
    g_band_state.last_update_ms     = now_ms;

    /* --- Step delta detection --- */
    if (steps >= g_band_state.prev_steps) {
        g_band_state.steps = steps;
    }
    /* steps counter may wrap at 65535 on the band; accept regression */

    /* --- Step goal reached? (fires once per session) --- */
    if (!g_band_state.steps_goal_reached &&
        g_band_state.steps >= THRESHOLD_STEPS_GOAL) {
        g_band_state.steps_goal_reached = true;
    }

    /* --- Heart-rate threshold counters --- */
    if (heart_rate > 0) {
        if (heart_rate > THRESHOLD_HR_HIGH) {
            g_band_state.high_hr_count++;
        } else if (heart_rate > 0 && heart_rate < THRESHOLD_HR_LOW) {
            g_band_state.low_hr_count++;
        }
    }

    /* --- High-impact counter + classifier trigger --- */
    if (peak_x100 >= THRESHOLD_PEAK_FALL) {
        g_band_state.high_impact_count++;

        /* IMPACT detected: start the watch window if we haven't already.
         * This captures BOTH the spike instant (impact_ms) and lets the
         * main task observe subsequent stillness. */
        if (g_band_state.impact_ms == 0) {
            g_band_state.impact_ms          = now_ms;
            g_band_state.stillness_start_ms = 0;   /* not still yet */
            g_band_state.real_fall          = false;
            g_band_state.soft_fall          = false;
            ESP_LOGW(TAG, "IMPACT detected (peak=%.2fg) — watching for stillness",
                     (double)peak_x100 / 100.0);
        }
    }

    g_band_state.prev_steps = g_band_state.steps;
}

/* ========================================================================
 * band_evaluate_alerts — called from main task (non-BLE context)
 *
 * Evaluates current g_band_state and returns the highest-priority alert
 * that should be acted on.  Checks cooldown to avoid repeated firing.
 *
 * Priority order (highest first):
 *   1. FALL_CONFIRMED   (critical)
 *   2. FALL_SUSPECT     (IMPACT_WAIT)       (warn)
 *   3. BATTERY_CRITICAL (< 5%)              (critical)
 *   4. BATTERY_LOW      (< 20%)             (warn)
 *   5. SENSOR_OFFLINE  (> 15 s no data)    (warn)
 *   6. HIGH_HR          (HR > 120)          (warn)
 *   7. LOW_HR           (HR < 45)           (warn)
 *   8. HIGH_ACTIVITY    (peak >= 6g)        (warn)
 *   9. STEPS_GOAL       (once per day)      (info)
 * ======================================================================== */
band_alert_type_t band_evaluate_alerts(void)
{
    const uint64_t now_ms = esp_timer_get_time() / 1000ULL;

    /* --- Offline check --- */
    if (!band_is_online()) {
        /* No recent data — flag sensor offline once per session */
        if (band_alert_can_fire(BAND_ALERT_SENSOR_OFFLINE)) {
            g_band_state.last_alert       = BAND_ALERT_SENSOR_OFFLINE;
            g_band_state.last_alert_sev   = BAND_SEVERITY_WARN;
            g_band_state.last_alert_ms    = now_ms;
            return BAND_ALERT_SENSOR_OFFLINE;
        }
        return BAND_ALERT_NONE;
    }

    /* --- 1. FALL_CONFIRMED (highest priority) --- */
    if (g_band_state.state == BAND_STATE_FALL_CONFIRMED) {
        if (!g_band_state.fall_alert_active) {
            g_band_state.fall_alert_active   = true;
            g_band_state.fall_confirmed_ms   = now_ms;
        }
        if (band_alert_can_fire(BAND_ALERT_FALL_CONFIRMED)) {
            g_band_state.last_alert     = BAND_ALERT_FALL_CONFIRMED;
            g_band_state.last_alert_sev = BAND_SEVERITY_CRITICAL;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_FALL_CONFIRMED;
        }
    }

    /* --- 2. FALL_SUSPECT (IMPACT_WAIT) --- */
    if (g_band_state.state == BAND_STATE_IMPACT_WAIT) {
        if (band_alert_can_fire(BAND_ALERT_FALL_SUSPECT)) {
            g_band_state.last_alert     = BAND_ALERT_FALL_SUSPECT;
            g_band_state.last_alert_sev = BAND_SEVERITY_WARN;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_FALL_SUSPECT;
        }
    }

    /* --- 3. Battery critical (< 5%) --- */
    if (g_band_state.battery > 0 && g_band_state.battery < THRESHOLD_BAT_CRIT) {
        if (band_alert_can_fire(BAND_ALERT_BATTERY_CRITICAL)) {
            g_band_state.last_alert     = BAND_ALERT_BATTERY_CRITICAL;
            g_band_state.last_alert_sev = BAND_SEVERITY_CRITICAL;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_BATTERY_CRITICAL;
        }
    }

    /* --- 4. Battery low (< 20%) --- */
    if (g_band_state.battery > 0 && g_band_state.battery < THRESHOLD_BAT_WARN) {
        if (band_alert_can_fire(BAND_ALERT_BATTERY_LOW)) {
            g_band_state.last_alert     = BAND_ALERT_BATTERY_LOW;
            g_band_state.last_alert_sev = BAND_SEVERITY_WARN;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_BATTERY_LOW;
        }
    }

    /* --- 5. High heart rate (> 120 bpm) --- */
    if (g_band_state.heart_rate > THRESHOLD_HR_HIGH) {
        if (band_alert_can_fire(BAND_ALERT_HIGH_HEART_RATE)) {
            g_band_state.last_alert     = BAND_ALERT_HIGH_HEART_RATE;
            g_band_state.last_alert_sev = BAND_SEVERITY_WARN;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_HIGH_HEART_RATE;
        }
    }

    /* --- 6. Low heart rate (< 45 bpm) --- */
    if (g_band_state.heart_rate > 0 && g_band_state.heart_rate < THRESHOLD_HR_LOW) {
        if (band_alert_can_fire(BAND_ALERT_LOW_HEART_RATE)) {
            g_band_state.last_alert     = BAND_ALERT_LOW_HEART_RATE;
            g_band_state.last_alert_sev = BAND_SEVERITY_WARN;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_LOW_HEART_RATE;
        }
    }

    /* --- 7. Fall classifier (real-fall vs soft-fall detection) ---
     *
     * Two-stage logic:
     *   Stage 1 (impact): triggered by peak >= 8g.
     *   Stage 2 (stillness watch): after impact, observe magnitude.
     *     - If |a| stays < 1.05g for 3 s continuously within a 6 s
     *       window → REAL_FALL → beep forever.
     *     - If |a| goes above 1.05g during the window → SOFT_FALL
     *       (subject still moving / recovering).
     *
     * Implementation runs in band_evaluate_alerts() which is called
     * every loop tick by the main task.
     */
    if (g_band_state.impact_ms != 0) {
        const uint64_t since_impact = now_ms - g_band_state.impact_ms;

        if (!g_band_state.real_fall && !g_band_state.soft_fall) {
            /* We are in the watch window */
            if (since_impact > FALL_WATCH_WINDOW_MS) {
                /* Window expired with no stillness detected → soft fall */
                g_band_state.soft_fall = true;
                g_band_state.impact_ms = 0;
                g_band_state.stillness_start_ms = 0;
                ESP_LOGI(TAG, "Movement after impact (%.2fg) — soft fall, no alarm",
                         (double)g_band_state.magnitude_x100 / 100.0);
            } else if (g_band_state.magnitude_x100 >= STILLNESS_MAGNITUDE_MAX) {
                /* Subject is moving — start counting stillness timer fresh */
                g_band_state.stillness_start_ms = 0;

                /* If they move a lot right after impact → soft fall */
                if (since_impact > 500 &&
                    g_band_state.magnitude_x100 > 200) {
                    g_band_state.soft_fall = true;
                    g_band_state.impact_ms = 0;
                    ESP_LOGI(TAG, "Big movement (%.2fg) shortly after impact "
                                  "— soft fall",
                             (double)g_band_state.magnitude_x100 / 100.0);
                }
            } else {
                /* Magnitude < 1.05g → still. Start/continue stillness timer. */
                if (g_band_state.stillness_start_ms == 0) {
                    g_band_state.stillness_start_ms = now_ms;
                }
                if ((now_ms - g_band_state.stillness_start_ms) >=
                    STILLNESS_REQUIRED_MS) {
                    /* Confirmed stillness for STILLNESS_REQUIRED_MS
                     * → REAL FALL → beep forever. */
                    g_band_state.real_fall = true;
                    g_band_state.in_danger_zone = true;
                    g_band_state.last_beep_ms   = 0;  /* beep immediately */
                    ESP_LOGE(TAG,
                             "REAL FALL CONFIRMED (peak=%.2fg, "
                             "|a|=%.2fg, still for %llu ms)",
                             (double)g_band_state.peak_x100 / 100.0,
                             (double)g_band_state.magnitude_x100 / 100.0,
                             (unsigned long long)
                             (now_ms - g_band_state.stillness_start_ms));
                }
            }
        }

        /* Real fall wins: return alert unconditionally so main loop starts
         * the continuous beep loop. The loop only ends when subject moves
         * (magnitude > STILLNESS_MAGNITUDE_MAX). */
        if (g_band_state.real_fall) {
            g_band_state.last_alert     = BAND_ALERT_FALL_CONFIRMED;
            g_band_state.last_alert_sev = BAND_SEVERITY_CRITICAL;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_FALL_CONFIRMED;
        }

        /* Soft fall: nothing to do, we silenced it */
        if (g_band_state.soft_fall) {
            return BAND_ALERT_NONE;
        }
    }

    /* After a real fall is in progress, if subject starts moving
     * (magnitude > 1.05g = 105), they're recovering → stop alarm. */
    if (g_band_state.real_fall &&
        g_band_state.magnitude_x100 > STILLNESS_MAGNITUDE_MAX + 100) {
        ESP_LOGI(TAG, "Subject moved after real fall (%.2fg) — silencing alarm",
                 (double)g_band_state.magnitude_x100 / 100.0);
        g_band_state.real_fall = false;
        g_band_state.in_danger_zone = false;
        g_band_state.impact_ms = 0;
        g_band_state.stillness_start_ms = 0;
    }

    /* --- 7b. Re-trigger beep every 5s while peak stays >= 8g ---
     * Mỗi tick (200ms) đều kiểm tra. Trong audio handler, phát 1 tiếng
     * beep rồi block 5s. Sau 5s, nếu peak vẫn >= 8g → return HIGH_ACTIVITY
     * lần nữa → phát thêm 1 tiếng beep. Lặp đến khi peak rời xuống
     * < 8g (và < 1.4g hysteresis để reset in_danger_zone).
     * Không check gì trong lúc phát — chỉ gọi audio_play rồi delay 5s. */
    if (g_band_state.peak_x100 >= THRESHOLD_PEAK_FALL) {
        g_band_state.in_danger_zone = true;
        g_band_state.last_beep_ms   = 0;
        if (band_alert_can_fire(BAND_ALERT_HIGH_ACTIVITY)) {
            g_band_state.last_alert     = BAND_ALERT_HIGH_ACTIVITY;
            g_band_state.last_alert_sev = BAND_SEVERITY_WARN;
            g_band_state.last_alert_ms  = now_ms;
        }
        return BAND_ALERT_HIGH_ACTIVITY;
    }

    /* Exited danger zone (with hysteresis) */
    if (g_band_state.in_danger_zone && g_band_state.peak_x100 < THRESHOLD_PEAK_REST) {
        g_band_state.in_danger_zone = false;
        g_band_state.last_beep_ms   = 0;
        ESP_LOGI(TAG, "peak back to normal (%.2fg) — stopping activity beep",
                 (double)g_band_state.peak_x100 / 100.0);
    }

    /* --- 8. Daily step goal reached (fires once) --- */
    if (g_band_state.steps_goal_reached) {
        if (band_alert_can_fire(BAND_ALERT_STEPS_GOAL)) {
            g_band_state.last_alert     = BAND_ALERT_STEPS_GOAL;
            g_band_state.last_alert_sev = BAND_SEVERITY_INFO;
            g_band_state.last_alert_ms  = now_ms;
            return BAND_ALERT_STEPS_GOAL;
        }
    }

    return BAND_ALERT_NONE;
}

/* ========================================================================
 * band_acknowledge_fall — called when user presses button to silence
 * ======================================================================== */
void band_acknowledge_fall(void)
{
    g_band_state.fall_alert_acknowledged = true;
    /* Reset so a new fall can trigger again later */
    g_band_state.fall_alert_active = false;
    /* Immediately expire the cooldown for FALL_CONFIRMED so it can re-fire
     * if another fall is detected */
    g_band_state.last_alert = BAND_ALERT_NONE;
}

/* ========================================================================
 * Continuous-beep helpers — used by lumo_runtime.c beep loop
 * ======================================================================== */

bool band_in_danger_zone(band_alert_type_t alert)
{
    switch (alert) {
    case BAND_ALERT_FALL_CONFIRMED:
        /* Real fall: keep beeping until subject moves (> 1.05g+1g buffer) */
        return g_band_state.real_fall;

    case BAND_ALERT_HIGH_ACTIVITY:
        return g_band_state.in_danger_zone &&
               g_band_state.peak_x100 >= THRESHOLD_PEAK_REST;

    case BAND_ALERT_HIGH_HEART_RATE:
        return g_band_state.heart_rate > THRESHOLD_HR_HIGH;

    case BAND_ALERT_LOW_HEART_RATE:
        return g_band_state.heart_rate > 0 &&
               g_band_state.heart_rate < THRESHOLD_HR_LOW;

    case BAND_ALERT_BATTERY_CRITICAL:
        return g_band_state.battery > 0 &&
               g_band_state.battery < THRESHOLD_BAT_CRIT;

    case BAND_ALERT_BATTERY_LOW:
        return g_band_state.battery > 0 &&
               g_band_state.battery < THRESHOLD_BAT_WARN;

    default:
        return false;
    }
}

bool band_should_beep(band_alert_type_t alert)
{
    if (!band_in_danger_zone(alert)) {
        return false;
    }
    const uint64_t now_ms = esp_timer_get_time() / 1000ULL;
    /* First call after entering zone: last_beep_ms == 0 → beep immediately */
    if (g_band_state.last_beep_ms == 0) {
        return true;
    }
    return (now_ms - g_band_state.last_beep_ms) >= ACTIVITY_BEEP_INTERVAL_MS;
}

void band_mark_beep(void)
{
    g_band_state.last_beep_ms = esp_timer_get_time() / 1000ULL;
}
