CREATE TABLE IF NOT EXISTS readings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 device_id TEXT NOT NULL,
 boot_id TEXT NOT NULL,
 sequence INTEGER NOT NULL CHECK(sequence >= 0),
 timestamp INTEGER NOT NULL,
 temperature_c REAL NOT NULL CHECK(temperature_c BETWEEN -40 AND 125),
 vibration_rms REAL NOT NULL CHECK(vibration_rms BETWEEN 0 AND 100),
 UNIQUE(device_id,boot_id,sequence)
);
CREATE INDEX IF NOT EXISTS readings_device_time ON readings(device_id,timestamp DESC);
