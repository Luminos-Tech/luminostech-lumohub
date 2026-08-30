cmake_minimum_required(VERSION 3.20.0)
# Make the app-local board definition discoverable by west/Zephyr.
list(APPEND BOARD_ROOT ${CMAKE_CURRENT_LIST_DIR})
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(lumo_band)

target_include_directories(app PRIVATE include)
target_sources(app PRIVATE
  src/main.c
  src/lumo_ble.c
  src/esp32_link.c
)
