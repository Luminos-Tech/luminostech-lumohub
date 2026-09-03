#ifndef LUMO_BAND_CONFIG_H
#define LUMO_BAND_CONFIG_H

/*
 * The ESP32-C3 band is a BLE peripheral. A phone or companion hub scans and
 * connects as a BLE central, subscribes to TX, and writes commands to RX.
 */
#define LUMO_BAND_DEVICE_NAME "LUMO-BAND"

/* Keep these UUIDs in sync with every phone/hub BLE client. */
#define LUMO_BAND_SERVICE_UUID \
    "7c5a0001-5d5a-4f7b-8c3a-6a6d2e8f1001"
#define LUMO_BAND_TX_UUID \
    "7c5a0002-5d5a-4f7b-8c3a-6a6d2e8f1001"
#define LUMO_BAND_RX_UUID \
    "7c5a0003-5d5a-4f7b-8c3a-6a6d2e8f1001"

/* Select the peer transport here. BLE is the production default. */
#define LUMO_LINK_TRANSPORT_BLE 0
#define LUMO_LINK_TRANSPORT_UART 1
#define LUMO_LINK_TRANSPORT_CUSTOM 2

#define LUMO_ESP32_LINK_TRANSPORT LUMO_LINK_TRANSPORT_BLE

/* TODO: Fill these in when the physical link is selected. */
#define LUMO_ESP32_UART_LABEL "TODO_COMPANION_UART"
#define LUMO_ESP32_UART_BAUDRATE 115200
#define LUMO_ESP32_BLE_PEER_ADDRESS "TODO: optional bonded peer address"

#endif /* LUMO_BAND_CONFIG_H */
