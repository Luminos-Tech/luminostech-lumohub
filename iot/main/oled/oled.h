#ifndef OLED_H
#define OLED_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"

#define OLED_WIDTH 128
#define OLED_HEIGHT 64

esp_err_t oled_begin(int sda_pin, int scl_pin, uint8_t i2c_addr);
void oled_clear(void);
void oled_fill(void);
void oled_update(void);

void oled_draw_pixel(int x, int y, bool color);
void oled_draw_hline(int x, int y, int w, bool color);
void oled_draw_vline(int x, int y, int h, bool color);
void oled_draw_rect(int x, int y, int w, int h, bool color);

void oled_draw_char_5x7(int x, int y, char c, bool color);
void oled_draw_text_5x7(int x, int y, const char *text, bool color);

#endif