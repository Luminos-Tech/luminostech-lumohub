cmake_minimum_required(VERSION 3.16)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(Lumo-LuminosTech)

spiffs_create_partition_image(spiffs spiffs FLASH_IN_PROJECT)