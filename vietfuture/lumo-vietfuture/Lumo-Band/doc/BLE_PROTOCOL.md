# Lumo-Band BLE protocol

The ESP32-C3 advertises `LUMO-TEST-C3` and keeps the existing 128-bit service
and sample characteristic. The characteristic remains `READ | NOTIFY`.

- Service UUID: `12345678-1234-5678-1234-56789abcdef0`
- Characteristic UUID: `12345678-1234-5678-1234-56789abcdef1`

## Payload version 0x02

Every payload is exactly 12 bytes. Multi-byte fields are little-endian.

| Bytes | Field | Type | Meaning |
| --- | --- | --- | --- |
| 0 | version | uint8 | Always `0x02` |
| 1 | state | uint8 | `0=IDLE`, `1=MOVE`, `2=IMPACT_WAIT`, `3=FALL_CONFIRMED`, `4=SENSOR_OFFLINE` |
| 2-3 | mag_x100 | uint16 LE | Current acceleration magnitude in g multiplied by 100 |
| 4-5 | peak1s_x100 | uint16 LE | Maximum acceleration magnitude in the latest 1 second multiplied by 100 |
| 6 | hr | uint8 | Test heart-rate value, range 60-100 |
| 7-8 | steps | uint16 LE | Test step value, range 1000-9999 |
| 9 | battery | uint8 | Test battery value, range 50-100 |
| 10 | reserved | uint8 | `0x00` |
| 11 | reserved | uint8 | `0x00` |

Example for a stationary sensor at `|a|=1.00g`, peak `1.02g`, state IDLE,
`hr=72`, `steps=1234`, `battery=88`:

```text
02 00 64 00 66 00 48 D2 04 58 00 00
```

The service UUID and characteristic UUID are unchanged from the original
firmware; only the characteristic payload layout changed.
