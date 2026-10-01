#pragma once
// Copy to secrets.h locally. That filename is git-ignored. Do not commit credentials.
const char* WIFI_SSID = "YOUR_NETWORK";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* DEVICE_ID = "BW-001";
const char* DEVICE_KEY = "REPLACE_WITH_A_RANDOM_PER_DEVICE_SECRET";
const char* TELEMETRY_URL = "https://YOUR_DEPLOYMENT.workers.dev/api/telemetry";
// Retrieve the issuing root CA from the certificate provider for your deployment.
// This deliberate placeholder will not establish a connection.
const char* ROOT_CA = R"PEM(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_YOUR_SERVER_ISSUING_ROOT_CA
-----END CERTIFICATE-----
)PEM";
