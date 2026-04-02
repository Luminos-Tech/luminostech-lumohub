#include "oled.h"

#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "esp_err.h"
#include "esp_check.h"
#include "font5x7/font5x7.h"

static const char *TAG = "OLED";

#define I2C_FREQ_HZ 100000
#define OLED_BUF_SIZE (OLED_WIDTH * OLED_HEIGHT / 8)

static i2c_master_bus_handle_t s_bus_handle = NULL;
static i2c_master_dev_handle_t s_oled_dev = NULL;
static uint8_t s_oled_buf[OLED_BUF_SIZE];

static void oled_send_cmd(uint8_t cmd)
{
    uint8_t buf[2] = {0x00, cmd};
    ESP_ERROR_CHECK(i2c_master_transmit(s_oled_dev, buf, sizeof(buf), -1));
}

static void oled_send_data(const uint8_t *data, size_t len)
{
    uint8_t tx[len + 1];
    tx[0] = 0x40;
    memcpy(&tx[1], data, len);
    ESP_ERROR_CHECK(i2c_master_transmit(s_oled_dev, tx, sizeof(tx), -1));
}

static void oled_init_panel(void)
{
    vTaskDelay(pdMS_TO_TICKS(100));

    oled_send_cmd(0xAE);
    oled_send_cmd(0xD5);
    oled_send_cmd(0x80);

    oled_send_cmd(0xA8);
    oled_send_cmd(0x3F);

    oled_send_cmd(0xD3);
    oled_send_cmd(0x00);

    oled_send_cmd(0x40);

    oled_send_cmd(0xAD);
    oled_send_cmd(0x8B);

    oled_send_cmd(0xA1);
    oled_send_cmd(0xC0);

    oled_send_cmd(0xDA);
    oled_send_cmd(0x12);

    oled_send_cmd(0x81);
    oled_send_cmd(0xCF);

    oled_send_cmd(0xD9);
    oled_send_cmd(0xF1);

    oled_send_cmd(0xDB);
    oled_send_cmd(0x40);

    oled_send_cmd(0xA4);
    oled_send_cmd(0xA6);
    oled_send_cmd(0xAF);
}

static const uint8_t *get_char_bitmap(char c)
{
    switch (c)
    {
    case '0':
        return FONT_0;
    case '1':
        return FONT_1;
    case '2':
        return FONT_2;
    case '3':
        return FONT_3;
    case '4':
        return FONT_4;
    case '5':
        return FONT_5;
    case '6':
        return FONT_6;
    case '7':
        return FONT_7;
    case '8':
        return FONT_8;
    case '9':
        return FONT_9;

    case 'A':
        return FONT_A;
    case 'B':
        return FONT_B;
    case 'C':
        return FONT_C;
    case 'D':
        return FONT_D;
    case 'E':
        return FONT_E;
    case 'F':
        return FONT_F;
    case 'G':
        return FONT_G;
    case 'H':
        return FONT_H;
    case 'I':
        return FONT_I;
    case 'J':
        return FONT_J;
    case 'K':
        return FONT_K;
    case 'L':
        return FONT_L;
    case 'M':
        return FONT_M;
    case 'N':
        return FONT_N;
    case 'O':
        return FONT_O;
    case 'P':
        return FONT_P;
    case 'Q':
        return FONT_Q;
    case 'R':
        return FONT_R;
    case 'S':
        return FONT_S;
    case 'T':
        return FONT_T;
    case 'U':
        return FONT_U;
    case 'V':
        return FONT_V;
    case 'W':
        return FONT_W;
    case 'X':
        return FONT_X;
    case 'Y':
        return FONT_Y;
    case 'Z':
        return FONT_Z;
    case 'a':
        return FONT_a;
    case 'b':
        return FONT_b;
    case 'c':
        return FONT_c;
    case 'd':
        return FONT_d;
    case 'e':
        return FONT_e;
    case 'f':
        return FONT_f;
    case 'g':
        return FONT_g;
    case 'h':
        return FONT_h;
    case 'i':
        return FONT_i;
    case 'j':
        return FONT_j;
    case 'k':
        return FONT_k;
    case 'l':
        return FONT_l;
    case 'm':
        return FONT_m;
    case 'n':
        return FONT_n;
    case 'o':
        return FONT_o;
    case 'p':
        return FONT_p;
    case 'q':
        return FONT_q;
    case 'r':
        return FONT_r;
    case 's':
        return FONT_s;
    case 't':
        return FONT_t;
    case 'u':
        return FONT_u;
    case 'v':
        return FONT_v;
    case 'w':
        return FONT_w;
    case 'x':
        return FONT_x;
    case 'y':
        return FONT_y;
    case 'z':
        return FONT_z;

    case '.':
        return FONT_DOT;
    case ',':
        return FONT_COMMA;
    case ':':
        return FONT_COLON;
    case ';':
        return FONT_SEMICOLON;
    case '-':
        return FONT_MINUS;
    case '_':
        return FONT_UNDERSCORE;
    case '/':
        return FONT_SLASH;
    case '\\':
        return FONT_BACKSLASH;
    case '!':
        return FONT_EXCLAM;
    case '?':
        return FONT_QUESTION;
    case '(':
        return FONT_LPAREN;
    case ')':
        return FONT_RPAREN;
    case '+':
        return FONT_PLUS;
    case '=':
        return FONT_EQUAL;
    case ' ':

        return FONT_SPACE;
    default:
        return FONT_SPACE;
    }
}

esp_err_t oled_begin(int sda_pin, int scl_pin, uint8_t i2c_addr)
{
    i2c_master_bus_config_t bus_config = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_NUM_0,
        .scl_io_num = scl_pin,
        .sda_io_num = sda_pin,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };

    ESP_RETURN_ON_ERROR(i2c_new_master_bus(&bus_config, &s_bus_handle), TAG, "i2c_new_master_bus failed");

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = i2c_addr,
        .scl_speed_hz = I2C_FREQ_HZ,
    };

    ESP_RETURN_ON_ERROR(i2c_master_bus_add_device(s_bus_handle, &dev_cfg, &s_oled_dev), TAG, "i2c add device failed");

    oled_init_panel();
    oled_clear();
    oled_update();

    ESP_LOGI(TAG, "OLED ready at 0x%02X", i2c_addr);
    return ESP_OK;
}

void oled_clear(void)
{
    memset(s_oled_buf, 0x00, sizeof(s_oled_buf));
}

void oled_fill(void)
{
    memset(s_oled_buf, 0xFF, sizeof(s_oled_buf));
}

void oled_draw_pixel(int x, int y, bool color)
{
    if (x < 0 || x >= OLED_WIDTH || y < 0 || y >= OLED_HEIGHT)
    {
        return;
    }

    int index = x + (y / 8) * OLED_WIDTH;
    uint8_t mask = 1 << (y % 8);

    if (color)
    {
        s_oled_buf[index] |= mask;
    }
    else
    {
        s_oled_buf[index] &= ~mask;
    }
}

void oled_draw_hline(int x, int y, int w, bool color)
{
    for (int i = 0; i < w; i++)
    {
        oled_draw_pixel(x + i, y, color);
    }
}

void oled_draw_vline(int x, int y, int h, bool color)
{
    for (int i = 0; i < h; i++)
    {
        oled_draw_pixel(x, y + i, color);
    }
}

void oled_draw_rect(int x, int y, int w, int h, bool color)
{
    oled_draw_hline(x, y, w, color);
    oled_draw_hline(x, y + h - 1, w, color);
    oled_draw_vline(x, y, h, color);
    oled_draw_vline(x + w - 1, y, h, color);
}

void oled_draw_char_5x7(int x, int y, char c, bool color)
{
    const uint8_t *bitmap = get_char_bitmap(c);

    for (int col = 0; col < 5; col++)
    {
        uint8_t line = bitmap[col];
        for (int row = 0; row < 7; row++)
        {
            bool pixel_on = (line >> row) & 0x01;
            if (pixel_on)
            {
                oled_draw_pixel(x + col, y + row, color);
            }
        }
    }
}

void oled_draw_text_5x7(int x, int y, const char *text, bool color)
{
    while (*text)
    {
        oled_draw_char_5x7(x, y, *text, color);
        x += 6;
        text++;
    }
}

void oled_update(void)
{
    for (int page = 0; page < 8; page++)
    {
        oled_send_cmd(0xB0 + page);
        oled_send_cmd(0x02);
        oled_send_cmd(0x10);
        oled_send_data(&s_oled_buf[OLED_WIDTH * page], OLED_WIDTH);
    }
}