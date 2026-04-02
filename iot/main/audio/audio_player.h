#ifndef AUDIO_PLAYER_H
#define AUDIO_PLAYER_H

#include "esp_err.h"
#include <stdbool.h>

esp_err_t audio_init(int bclk_gpio, int lrck_gpio, int dout_gpio);
esp_err_t audio_play(const char *filepath);
esp_err_t audio_stop(void);
bool audio_is_playing(void);

#endif