# Top-level CMakeLists for the Tino hardware project (ESP-IDF).
#
# This file is intentionally minimal — it just registers the project and
# pulls in the standard ESP-IDF build glue. Components are added later,
# after the product description in `../docs/` is finalised.

cmake_minimum_required(VERSION 3.16)

set(EXTRA_COMPONENT_DIRS "")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(tino-hardware)
