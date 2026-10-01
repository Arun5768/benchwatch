/*
 * BenchWatch reference node, ESP32 + ADXL345 + DS18B20.
 * Software reference only: not compiled/flashed or physically validated in this build.
 * Never use this prototype to control machinery or as a safety interlock.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>
#include "secrets.h"
#include "features.h"

Adafruit_ADXL345_Unified accel(345);
OneWire oneWire(4);
DallasTemperature temperature(&oneWire);
const uint16_t WINDOW = 256;
uint32_t sequenceNumber = 0;
char bootId[24];
bool sensorsReady = false;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  sensorsReady = accel.begin();
  if (!sensorsReady) { Serial.println("ADXL345 missing. No fabricated sensor values will be sent."); return; }
  accel.setRange(ADXL345_RANGE_4_G);
  accel.setDataRate(ADXL345_DATARATE_100_HZ);
  temperature.begin();
  temperature.setWaitForConversion(false);
  snprintf(bootId, sizeof(bootId), "%08lx-%08lx", (unsigned long)esp_random(), (unsigned long)esp_random());
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) delay(250);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void loop() {
  if (!sensorsReady) { delay(5000); return; }
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(5000); return; }
  time_t now = time(nullptr);
  if (now < 1700000000) { Serial.println("Waiting for NTP before TLS."); delay(2000); return; }
  temperature.requestTemperatures();
  DynamicRms features;
  uint32_t next = micros(), started = next;
  for (uint16_t i = 0; i < WINDOW; i++) {
    while ((int32_t)(micros() - next) < 0) delayMicroseconds(100);
    next += 10000; // Target 100 Hz. Measure the actual rate below.
    sensors_event_t event;
    accel.getEvent(&event);
    features.add(event.acceleration.x, event.acceleration.y, event.acceleration.z);
  }
  float rms = features.value(); // Dynamic acceleration RMS in m/s², not velocity.
  float tempC = temperature.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C || !isfinite(tempC) || tempC < -40 || tempC > 125 || !isfinite(rms)) {
    Serial.println("Invalid sensor reading; packet skipped."); delay(1000); return;
  }
  Serial.printf("Measured sample rate: %.1f Hz; RMS %.3f m/s2; temperature %.1f C\n",
    (WINDOW-1)*1000000.0/(micros()-started), rms, tempC);
  char payload[320];
  snprintf(payload, sizeof(payload),
    "{\"deviceId\":\"%s\",\"bootId\":\"%s\",\"sequence\":%lu,\"timestamp\":%llu,\"temperatureC\":%.2f,\"vibrationRms\":%.4f}",
    DEVICE_ID, bootId, (unsigned long)sequenceNumber++, (unsigned long long)time(nullptr)*1000ULL, tempC, rms);
  NetworkClientSecure client;
  client.setCACert(ROOT_CA); // Provision the correct CA. Never call setInsecure().
  HTTPClient http;
  http.setTimeout(5000);
  if (http.begin(client, TELEMETRY_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ")+DEVICE_KEY);
    int status = http.POST((uint8_t*)payload, strlen(payload));
    Serial.printf("Telemetry HTTP status: %d\n",status);
    // Values are not queued across resets; persistent buffering is a documented future improvement.
    http.end();
  }
  delay(2000);
}
