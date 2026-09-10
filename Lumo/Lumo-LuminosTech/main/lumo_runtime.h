#pragma once

#include <stdbool.h>

/* OLED đã TẮT trong bản v0.5.1-test-no-oled — struct không còn field display. */
typedef struct
{
    bool storage;
    bool button;
    bool audio;
    bool network;
    bool server_events;
    bool microphone;
    bool voice_assistant;
    bool microphone_level_log;
    bool microphone_record_test;
} lumo_feature_config_t;

void lumo_runtime_start(const lumo_feature_config_t *features);
