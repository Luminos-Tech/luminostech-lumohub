/**
 * @file lumo_band_state.h
 * @brief Shared state & threshold definitions for LumoBand BLE sensor data.
 *
 * Exported symbols (all defined in lumo_band_central.c):
 *   - Current sensor snapshot (atomic reads via volatile)
 *   - Alert flags / counters (written by BLE task, read by main task)
 *
 * Usage from any task:
 *   #include "ble/lumo_band_state.h"
 *   if (s_band_data.heart_rate > 120) { ... }
 */

#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "esp_timer.h"           /* esp_timer_get_time() used by static inlines */

/* ========================================================================
 * Alert types — ordered by severity
 * ======================================================================== */
typedef enum {
    BAND_ALERT_NONE = 0,         /* Normal, no action needed */
    BAND_ALERT_STEPS_GOAL,       /* Daily step goal reached      — INFO  */
    BAND_ALERT_HIGH_HEART_RATE,  /* HR > threshold               — WARN  */
    BAND_ALERT_LOW_HEART_RATE,   /* HR < threshold               — WARN  */
    BAND_ALERT_FALL_SUSPECT,     /* IMPACT_WAIT: possible fall   — WARN  */
    BAND_ALERT_FALL_CONFIRMED,   /* FALL_CONFIRMED: confirmed    — CRITICAL */
    BAND_ALERT_HIGH_ACTIVITY,    /* peak > 6g: heavy impact      — WARN  */
    BAND_ALERT_BATTERY_LOW,      /* battery < 20 %               — WARN  */
    BAND_ALERT_BATTERY_CRITICAL, /* battery < 5 %                — CRITICAL */
    BAND_ALERT_SENSOR_OFFLINE,   /* No BLE data > 15 s           — WARN  */
    BAND_ALERT_FALL_CANCELLED,   /* User cancelled fall alert    — INFO  */
    BAND_ALERT__MAX,
} band_alert_type_t;

/* Severity levels used to gate audio/notification behaviour */
typedef enum {
    BAND_SEVERITY_INFO      = 0,  /* Log only, no audio          */
    BAND_SEVERITY_WARN      = 1,  /* Soft alert: short beep       */
    BAND_SEVERITY_CRITICAL  = 2,  /* Loud alert: repeated beep    */
} band_severity_t;

/* Raw band state codes (from LumoBand BLE payload byte[1]) */
typedef enum {
    BAND_STATE_IDLE           = 0,
    BAND_STATE_MOVE           = 1,
    BAND_STATE_IMPACT_WAIT    = 2,   /* Possible fall — waiting 30 s */
    BAND_STATE_FALL_CONFIRMED = 3,
    BAND_STATE_SENSOR_OFFLINE = 4,
} band_state_t;

/* ========================================================================
 * Threshold definitions
 * Adjust these to suit your application's needs.
 * All timeouts are in milliseconds.
 * ======================================================================== */

/* Heart-rate thresholds (BPM) */
#define THRESHOLD_HR_HIGH    120   /* > 120 bpm → high HR alert   */
#define THRESHOLD_HR_LOW     45    /* < 45 bpm  → low  HR alert   */

/* Impact / activity thresholds (×100 units, e.g. 600 = 6.00 g) */
#define THRESHOLD_PEAK_FALL  800   /* >= 8.00 g → trigger beep (demo mode) */

/* Hysteresis band for high-activity alerts — enter at PEAK_FALL,
 * exit at PEAK_REST. Prevents chattering around the threshold.
 *
 * Demo mode: enter at 8g (impact), exit at 1.4g — gives margin above
 * the band sensor's idle noise floor (~1.05-1.30g). */
#define THRESHOLD_PEAK_REST  140   /* < 1.40 g → stop beep (demo mode) */

/* How often to repeat the beep while still in the danger zone */
#define ACTIVITY_BEEP_INTERVAL_MS 1500  /* 1.5 s between beeps       */

/* ----------------------------------------------------------------
 * Fall classifier — distinguishes "real fall" from "soft fall"
 *
 * Real fall:   peak ≥ 8g, then magnitude stabilises at 0.97-1.0g
 *              (subject still, motionless on the ground)
 * Soft fall:   peak ≥ 8g, then magnitude keeps fluctuating above
 *              STILLNESS_MAGNITUDE_MAX (subject still moving/
 *              recovering from the fall)
 *
 * After IMPACT, we watch the magnitude for FALL_WATCH_WINDOW_MS.
 * If magnitude stays < STILLNESS_MAGNITUDE_MAX for
 * STILLNESS_REQUIRED_MS, → real fall → start beeping forever.
 * If magnitude goes above STILLNESS_MAGNITUDE_MAX during the
 * window → soft fall → silence.
 * ---------------------------------------------------------------- */
#define FALL_WATCH_WINDOW_MS       6000  /* 6 s window to watch motion */
#define STILLNESS_REQUIRED_MS      3000  /* 3 s of stillness = real fall */
#define STILLNESS_MAGNITUDE_MAX    105   /* |a| < 1.05g = "still"       */

/* Step goal (daily) */
#define THRESHOLD_STEPS_GOAL 10000  /* steps per day goal           */

/* Battery thresholds (%) */
#define THRESHOLD_BAT_WARN   20     /* < 20 % → low battery warning */
#define THRESHOLD_BAT_CRIT    5     /* < 5  % → critical battery    */

/* Offline timeout — how long without BLE data before SENSOR_OFFLINE */
#define THRESHOLD_OFFLINE_TIMEOUT_MS 15000

/* Impact-Wait (possible fall) window — LumoBand sends this automatically
 * but we also enforce it locally in case the band stops sending. */
#define THRESHOLD_IMPACT_WAIT_MS 30000

/* Minimum interval between repeated audio alerts of the same type */
#define ALERT_COOLDOWN_MS    60000  /* 60 s between repeated beeps  */

/* ========================================================================
 * Shared sensor data struct
 *
 * Written by BLE NimBLE host task (high priority).
 * Read by main app_main task (medium priority).
 *
 * Only simple fields (int/bool) are used — safe to read without mutex
 * on ESP32 as int reads/writes are atomic for aligned 32-bit values.
 * For 64-bit timestamp we use volatile + memory barriers are implicit.
 * ======================================================================== */
typedef struct {
    /* --- Raw sensor fields --- */
    band_state_t  state;           /* 0=IDLE 1=MOVE 2=IMPACT_WAIT 3=FALL 4=OFFLINE */
    uint8_t       heart_rate;      /* BPM, 0 = no data              */
    uint16_t      steps;           /* Daily step counter            */
    uint8_t       battery;         /* Battery %, 0 = no data        */
    uint16_t      magnitude_x100;  /* |a| × 100 (e.g. 101 = 1.01g)  */
    uint16_t      peak_x100;       /* 1-second peak × 100           */
    uint64_t      last_update_ms;  /* Timestamp (esp_timer_get_time) */

    /* --- Derived / alert fields --- */
    band_alert_type_t  last_alert;     /* Most recent alert raised       */
    band_severity_t    last_alert_sev; /* Severity of last_alert         */
    uint64_t           last_alert_ms;   /* Timestamp of last_alert        */
    bool               fall_alert_active;  /* True once FALL_CONFIRMED     */
    bool               fall_alert_acknowledged; /* User confirmed/responded  */
    uint64_t           fall_confirmed_ms;     /* When fall was confirmed     */

    /* --- Counters --- */
    uint32_t  high_hr_count;        /* # samples with HR > THRESHOLD_HR_HIGH  */
    uint32_t  low_hr_count;         /* # samples with HR < THRESHOLD_HR_LOW   */
    uint32_t  high_impact_count;    /* # samples with peak > THRESHOLD_PEAK   */

    /* --- Step goal tracking --- */
    bool      steps_goal_reached;   /* Set once daily goal is hit         */
    uint16_t  prev_steps;          /* Previous steps value (for delta)    */

    /* --- Continuous-beep state (for HIGH_ACTIVITY / HR alerts) --- */
    bool               in_danger_zone;        /* True while threshold breached   */
    uint64_t           last_beep_ms;          /* When last beep was played       */

    /* --- Fall classifier state machine ---
     *
     * Tracks whether an impact was detected and watches for stillness.
     * Stage transitions:
     *   IDLE
     *     └─ peak >= 8g ──► IMPACT (just detected)
     *                          └─ magnitude stays < 1.05g for 3s
     *                              ─► REAL_FALL (beep forever)
     *                          └─ magnitude spikes > 1.05g
     *                              ─► SOFT_FALL (silence, no alert)
     *   REAL_FALL ──── magnitude > 1.05g ──► SOFT_FALL (recovered)
     */
    uint64_t           impact_ms;             /* When 8g spike happened          */
    uint64_t           stillness_start_ms;    /* When magnitude stayed below 1.05g */
    bool               real_fall;             /* True = real fall → keep beeping */
    bool               soft_fall;             /* True = soft fall → silenced     */
} lumo_band_shared_t;

/* ========================================================================
 * Global shared instance — defined once in lumo_band_central.c
 * ======================================================================== */
extern volatile lumo_band_shared_t g_band_state;

/* ========================================================================
 * Public API
 * ======================================================================== */

/**
 * @brief Check if the band sensor is considered online (recent data).
 * @return true if data received within THRESHOLD_OFFLINE_TIMEOUT_MS.
 */
static inline bool band_is_online(void)
{
    return (esp_timer_get_time() / 1000ULL) - g_band_state.last_update_ms
           < THRESHOLD_OFFLINE_TIMEOUT_MS;
}

/**
 * @brief Check if a fresh alert of the given type can be raised.
 * Enforces ALERT_COOLDOWN_MS between repeated alerts of the same type.
 */
static inline bool band_alert_can_fire(band_alert_type_t type)
{
    if (g_band_state.last_alert != type) {
        return true;
    }
    return ((esp_timer_get_time() / 1000ULL) - g_band_state.last_alert_ms)
           >= ALERT_COOLDOWN_MS;
}

/**
 * @brief Get a human-readable string for an alert type.
 */
const char *band_alert_type_str(band_alert_type_t type);

/**
 * @brief Get a human-readable string for a band state.
 */
const char *band_state_str(band_state_t state);

/**
 * @brief Update the shared band state from parsed BLE payload bytes.
 * Called from within the BLE NimBLE host task.
 *
 * @param state             Band state byte (0-4)
 * @param heart_rate        Heart rate BPM
 * @param steps             Daily steps
 * @param battery           Battery percent
 * @param magnitude_x100    |acceleration| × 100
 * @param peak_x100         1-second peak × 100
 */
void band_state_update(uint8_t  state,
                       uint8_t  heart_rate,
                       uint16_t steps,
                       uint8_t  battery,
                       uint16_t magnitude_x100,
                       uint16_t peak_x100);

/**
 * @brief Called by main task to evaluate alert thresholds.
 * Returns the highest-severity alert that should be acted upon,
 * or BAND_ALERT_NONE if nothing needs action.
 *
 * Only fires new alerts; respects cooldown.
 */
band_alert_type_t band_evaluate_alerts(void);

/**
 * @brief Call when user acknowledges a fall alert.
 * Silences the fall alarm and marks the alert as acknowledged.
 */
void band_acknowledge_fall(void);

/**
 * @brief Returns true if a continuous-beep alert is currently active AND
 *        enough time has passed since the last beep to fire another.
 *
 * Used by the main loop to decide whether to keep playing beep.wav every
 * ACTIVITY_BEEP_INTERVAL_MS while the condition holds.
 *
 * Example (high-activity):
 *   while (band_should_beep(BAND_ALERT_HIGH_ACTIVITY)) {
 *       audio_play("/spiffs/beep.wav");
 *       band_mark_beep();
 *   }
 */
bool band_should_beep(band_alert_type_t alert);

/**
 * @brief Mark that a beep was just played — updates last_beep_ms.
 * Call after each successful audio_play() inside the beep loop.
 */
void band_mark_beep(void);

/**
 * @brief True if the sensor reading is still in the danger zone for the
 *        given alert type (uses hysteresis).
 */
bool band_in_danger_zone(band_alert_type_t alert);
