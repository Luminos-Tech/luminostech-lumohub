#pragma once

#include <stdbool.h>

typedef struct
{
    bool storage;
    bool button;
    bool audio;
    bool display;
    bool network;
    bool server_events;
    bool microphone;
    bool voice_assistant;
    bool microphone_level_log;
    bool microphone_record_test;
} lumo_feature_config_t;

void lumo_runtime_start(const lumo_feature_config_t *features);
