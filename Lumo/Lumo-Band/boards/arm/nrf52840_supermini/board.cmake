# SPDX-License-Identifier: Apache-2.0

# Most Super Mini boards expose a UF2 bootloader over USB. SWD runners remain
# available for boards shipped without UF2; select one explicitly at flash time.
include(${ZEPHYR_BASE}/boards/common/uf2.board.cmake)
board_runner_args(nrfjprog "--nrf-family=NRF52")
include(${ZEPHYR_BASE}/boards/common/nrfjprog.board.cmake)
