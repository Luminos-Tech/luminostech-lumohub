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

## MPU diagnostic packet 0x03 (Band v0.3.0)

The same characteristic sends an additional 20-byte NOTIFY every 2 seconds.
This fits the default ATT MTU and does not replace or change the v2 sample or
fall notification cadence. Hub firmware v0.5.12 accepts both packet types.

| Bytes | Field | Meaning |
| --- | --- | --- |
| 0 | version | `0x03` |
| 1 | state | Same state mapping as v2; `4` means MPU offline |
| 2–3 | sample_sequence | Successful MPU read count modulo 65536 |
| 4–5 | sample_age_ms | Age of last successful MPU read; 65535 if none/too old |
| 6–7, 8–9, 10–11 | accel X/Y/Z | Signed int16 little-endian, divide by 4096 for g |
| 12–13, 14–15, 16–17 | gyro X/Y/Z | Signed int16 little-endian, divide by 131 for degrees/second |
| 18–19 | magnitude_x100 | Acceleration magnitude in g multiplied by 100 |

Sequence increments on a successful I2C read (100 ms cadence), not when sending
a BLE packet. Offline packets keep the previous read count/time; the Hub does
not display old axes as current when offline or stale. At a steady 2-second
diagnostic cadence the counter normally advances by roughly 20.

The Hub sends a `MPU6050` log line every ~2 seconds through its existing
WebSocket, including axes, magnitude, latest v2 peak, sequence and age.
If no BLE samples/diagnostics arrive for 6 seconds, it reports stale data.
Raw axes are withheld when offline/stale. These are diagnostics, not a claim
that the MPU is calibrated or fall detection has been validated.
