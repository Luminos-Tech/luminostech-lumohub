# Standalone ESP32-C3 NimBLE peripheral test.
idf_component_register(
    SRCS
        "../src/main.c"
        "../src/mpu6050.c"
    INCLUDE_DIRS
        "../include"
    REQUIRES
        bt
        driver
        esp_timer
        nvs_flash
)
