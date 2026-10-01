# BenchWatch hardware reference

## Validation status

The web app, detection rules and API are software-testable. The Arduino sketch has **not been compiled, flashed or tested against physical sensors** in this build. No accuracy, predictive-maintenance or industrial-safety claim is made.
ESP32 is a third-party board programmed through the Arduino framework. This is not an Arduino-branded hardware deployment.

## Bill of materials

- ESP32 DevKit with 3.3 V logic, using the Espressif Arduino core
- ADXL345 breakout explicitly compatible with 3.3 V power and logic
- DS18B20 temperature sensor with a 4.7 kohm data pull-up
- Breadboard, USB supply and insulated leads
- Optional guarded, low-voltage tabletop fan/motor test rig; do not instrument hazardous machinery

## Reference wiring

| Signal | ESP32  | Sensor                                         |
| ------ | ------ | ---------------------------------------------- |
| 3.3 V  | 3V3    | Both sensor VCC pins (verify breakout ratings) |
| Ground | GND    | Both grounds                                   |
| SDA    | GPIO21 | ADXL345 SDA                                    |
| SCL    | GPIO22 | ADXL345 SCL                                    |
| 1-Wire | GPIO4  | DS18B20 DQ; 4.7 kohm pull-up to 3.3 V          |

For I2C, an ADXL345 breakout typically needs CS high and a defined address pin. Verify the actual breakout schematic; do not assume wire colors or pin order on a DS18B20 probe.

## Arduino setup

1. Install Arduino IDE and the official Espressif ESP32 board package.
2. Install Adafruit ADXL345, Adafruit Unified Sensor, OneWire and DallasTemperature libraries from their respective maintained sources.
3. Open firmware/benchwatch/benchwatch.ino. Select your actual ESP32 board and port.
4. Copy secrets.example.h to secrets.h. Supply Wi-Fi, deployed HTTPS endpoint, device-specific key and the correct issuing root CA certificate.
5. Compile and flash. Check Serial Monitor at 115200 baud. Resolve missing-sensor or NTP errors before expecting readings.
6. Open the web app's live connection with the separate operator key.

## Feature extraction and limits

The sensor is configured to 100 Hz. Each 256-sample window measures three acceleration axes, subtracts each axis mean, then computes sqrt(var(x)+var(y)+var(z)). This removes stationary gravity but does not implement orientation compensation. Dynamic acceleration RMS has units m/s²; it is **not vibration velocity in mm/s**, and no ISO severity standard is applied.
Actual host sampling is approximate and printed to serial. Signals above the effective Nyquist frequency may alias. This low-cost rig is unsuitable for diagnosing bearing defects or high-frequency vibration. The sketch sends a feature window plus temperature every several seconds, not the simulated UI's 2-second cadence.

## First physical experiment

- Secure sensors on an unpowered, low-voltage test rig, with guards intact.
- Verify sensor operation against a reference instrument.
- Record at least five minutes of repeatable normal operation, including idle and intended operating loads.
- Label conditions and document mounting, sampling rate, ambient temperature and firmware version.
- Adjust the illustrative thresholds and baseline in public/domain.js only after this measurement.
- Run three repeat trials and report false positives, missed conditions and stale-packet behavior.
- Never create hazardous faults or loosen operating equipment to imitate the simulator.

## Next steps, not shipped features

- Persist unsent samples securely and retry with idempotent sequence IDs.
- Measured calibration and authenticated per-device provisioning.
- Collect labelled data before exploring an Edge Impulse model; no trained model is currently included.

References:

- https://github.com/espressif/arduino-esp32
- https://github.com/adafruit/Adafruit_ADXL345
- https://github.com/milesburton/Arduino-Temperature-Control-Library
- https://github.com/PaulStoffregen/OneWire
