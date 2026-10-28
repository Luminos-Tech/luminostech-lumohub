#pragma once

#include "esp_err.h"

esp_err_t device_control_start(const char *device_code, const char *firmware_version);

/* Non-blocking technical events only; never pass credentials or audio content. */
#ifdef LUMO_DEVICE_CONTROL_ENABLED
void device_control_log(char level, const char *tag, const char *message);
#else
static inline void device_control_log(char level, const char *tag, const char *message)
{
    (void)level;
    (void)tag;
    (void)message;
}
#endif
