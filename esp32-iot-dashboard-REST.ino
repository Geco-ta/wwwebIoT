/**
 * IoT Dashboard - ESP32 Firebase REST API (OPTIMIZED)
 * Lebih reliable daripada Firebase library
 * Real-time updates: 1 detik untuk sensor, instan untuk manual control
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// =======================
//   WIFI & FIREBASE
// =======================
#define WIFI_SSID     "F6"
#define WIFI_PASSWORD "kodok321"

#define DATABASE_URL  "https://iot-dashboard-ca956-default-rtdb.asia-southeast1.firebasedatabase.app"

// =======================
//   PIN SENSOR
// =======================
#define DHTPIN   23
#define DHTTYPE  DHT22
#define SOIL_PIN 34
#define LDR_PIN  35
DHT dht(DHTPIN, DHTTYPE);

// =======================
//  KALIBRASI SENSOR
// =======================
int airValue   = 3000;
int waterValue = 1200;
float Rfixed = 10000.0;

// =======================
//   PIN AKTUATOR
// =======================
#define FAN_IN1   16
#define FAN_IN2   17
#define FAN_ENA   5

#define PUMP_IN1  26
#define PUMP_IN2  27
#define PUMP_ENB  4

#define LAMP_PIN  25

// =======================
//   BATAS AUTO MODE
// =======================
const float TEMP_HIGH        = 32.0;
const float HUMID_LOW        = 71.0;
const float SOIL_LOW_PERCENT = 50.0;
const float LUX_LOW          = 22.0;

// =======================
//   TIMER & STATE (OPTIMIZED)
// =======================
unsigned long lastSensorSend = 0;
unsigned long lastCommandRead = 0;
unsigned long lastSeriesSave = 0;

// UPDATED: Real-time intervals
const unsigned long SENSOR_INTERVAL = 1000;       // 1 DETIK (bukan 1 menit)
const unsigned long COMMAND_INTERVAL = 1000;      // 1 DETIK untuk instant response
const unsigned long SERIES_INTERVAL = 60000;      // Tetap 1 menit untuk history

bool fanOn = false;
bool pumpOn = false;
bool lampOn = false;
String currentMode = "AUTO";

// =======================
//   FUNGSI AKTUATOR
// =======================
void setFan(bool on) {
  digitalWrite(FAN_IN1, on ? HIGH : LOW);
  digitalWrite(FAN_IN2, LOW);
  digitalWrite(FAN_ENA, HIGH);
  fanOn = on;
}

void setPump(bool on) {
  digitalWrite(PUMP_IN1, on ? HIGH : LOW);
  digitalWrite(PUMP_IN2, LOW);
  digitalWrite(PUMP_ENB, HIGH);
  pumpOn = on;
}

void setLamp(bool on) {
  digitalWrite(LAMP_PIN, on ? HIGH : LOW);
  lampOn = on;
}

// =======================
//   HTTP HELPER FUNCTIONS
// =======================
bool sendToFirebase(String path, String jsonData) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi disconnected!");
    return false;
  }

  HTTPClient http;
  String url = DATABASE_URL + path + ".json";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.PUT(jsonData);
  bool success = (httpCode == 200);
  
  if (!success) {
    Serial.printf("❌ PUT %s: HTTP %d\n", path.c_str(), httpCode);
  }
  
  http.end();
  return success;
}

bool readFromFirebase(String path, String& result) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi disconnected!");
    return false;
  }

  HTTPClient http;
  String url = DATABASE_URL + path + ".json";
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.GET();
  bool success = (httpCode == 200);
  
  if (success) {
    result = http.getString();
  } else {
    Serial.printf("❌ GET %s: HTTP %d\n", path.c_str(), httpCode);
  }
  
  http.end();
  return success;
}

// =======================
//        SETUP
// =======================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n===== ESP32 IoT Dashboard (REST API) =====");
  Serial.println("Mode: REAL-TIME (1 second updates)");
  Serial.println("==========================================\n");

  dht.begin();

  // Setup pins
  pinMode(FAN_IN1, OUTPUT);
  pinMode(FAN_IN2, OUTPUT);
  pinMode(FAN_ENA, OUTPUT);
  pinMode(PUMP_IN1, OUTPUT);
  pinMode(PUMP_IN2, OUTPUT);
  pinMode(PUMP_ENB, OUTPUT);
  pinMode(LAMP_PIN, OUTPUT);

  // Initial state
  setFan(false);
  setPump(false);
  setLamp(false);

  // -------- WIFI CONNECTION ---------
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int wifiRetry = 0;
  while (WiFi.status() != WL_CONNECTED && wifiRetry < 30) {
    delay(300);
    Serial.print(".");
    wifiRetry++;
  }
  
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("❌ WiFi Failed! Continuing anyway...");
  }

  Serial.println("\n✅ Firebase REST API Ready!");
  Serial.println("==========================================\n");

  delay(1000);
}

// =======================
//         LOOP (OPTIMIZED)
// =======================
void loop() {
  unsigned long now = millis();

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }

  // ======== SEND SENSOR EVERY 1 SECOND (REAL-TIME) ========
  if (now - lastSensorSend >= SENSOR_INTERVAL) {
    readAndSendSensors(now);
    lastSensorSend = now;
  }

  // ======== READ MODE & COMMANDS EVERY 1 SECOND (INSTANT RESPONSE) ========
  if (now - lastCommandRead >= COMMAND_INTERVAL) {
    readModeAndControl();
    lastCommandRead = now;
  }

  delay(10);
}

// =======================
//   BACA & KIRIM SENSOR
// =======================
void readAndSendSensors(unsigned long now) {
  // ======== BACA SENSOR ========
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) { 
    h = 0; 
    t = 0; 
  }

  int soilRaw = analogRead(SOIL_PIN);
  float soilPercent = map(constrain(soilRaw, waterValue, airValue), waterValue, airValue, 100, 0);
  soilPercent = constrain(soilPercent, 0, 100);

  int ldrRaw = analogRead(LDR_PIN);
  float Vout = ldrRaw * (3.3 / 4095.0);
  Vout = constrain(Vout, 0.01, 3.29);
  float Rldr = (3.3 - Vout) * Rfixed / Vout;
  float R_k = max(Rldr / 1000.0, 0.1);
  float lux = 500.0 / pow(R_k, 1.4);

  unsigned long timestamp = millis();

  // ======== KIRIM SENSOR CURRENT (SETIAP 1 DETIK) ========
  DynamicJsonDocument doc(256);
  doc["value"] = t;
  doc["timestamp"] = timestamp;
  String json;
  serializeJson(doc, json);
  sendToFirebase("/sensors/airTemp/current", json);

  doc.clear();
  doc["value"] = h;
  doc["timestamp"] = timestamp;
  json = "";
  serializeJson(doc, json);
  sendToFirebase("/sensors/airHumidity/current", json);

  doc.clear();
  doc["value"] = soilPercent;
  doc["timestamp"] = timestamp;
  json = "";
  serializeJson(doc, json);
  sendToFirebase("/sensors/soilMoisture/current", json);

  doc.clear();
  doc["value"] = lux;
  doc["timestamp"] = timestamp;
  json = "";
  serializeJson(doc, json);
  sendToFirebase("/sensors/light/current", json);

  // ======== KIRIM SERIES DATA (SETIAP 1 MENIT) ========
  if (now - lastSeriesSave >= SERIES_INTERVAL) {
    doc.clear();
    doc["value"] = t;
    doc["timestamp"] = timestamp;
    json = "";
    serializeJson(doc, json);
    sendToFirebase("/sensors/airTemp/series/" + String(timestamp), json);

    doc.clear();
    doc["value"] = h;
    doc["timestamp"] = timestamp;
    json = "";
    serializeJson(doc, json);
    sendToFirebase("/sensors/airHumidity/series/" + String(timestamp), json);

    doc.clear();
    doc["value"] = soilPercent;
    doc["timestamp"] = timestamp;
    json = "";
    serializeJson(doc, json);
    sendToFirebase("/sensors/soilMoisture/series/" + String(timestamp), json);

    doc.clear();
    doc["value"] = lux;
    doc["timestamp"] = timestamp;
    json = "";
    serializeJson(doc, json);
    sendToFirebase("/sensors/light/series/" + String(timestamp), json);

    lastSeriesSave = now;
  }

  // ======== DEBUG SERIAL ========
  Serial.println("===== SENSOR DATA (Real-time) =====");
  Serial.printf("Suhu       : %.1f °C\n", t);
  Serial.printf("Kelembapan : %.1f %%\n", h);
  Serial.printf("Tanah      : %.1f %%\n", soilPercent);
  Serial.printf("Cahaya     : %.1f lux\n", lux);
  Serial.println("====================================\n");
}

// =======================
//   BACA MODE & CONTROL
// =======================
void readModeAndControl() {
  // ======== BACA SYSTEM MODE ========
  String modeResponse;
  if (readFromFirebase("/system/mode", modeResponse)) {
    modeResponse.trim();
    // Remove quotes if present
    if (modeResponse.startsWith("\"")) {
      modeResponse = modeResponse.substring(1, modeResponse.length() - 1);
    }
    // Convert to lowercase untuk case-insensitive comparison
    modeResponse.toLowerCase();
    if (modeResponse == "manual" || modeResponse == "auto") {
      currentMode = modeResponse;
      Serial.printf("📡 Mode updated: %s\n", currentMode.c_str());
    }
  }

  if (currentMode == "manual") {
    // ======== MANUAL MODE - READ COMMANDS (INSTANT) ========
    readManualCommands();
  } else {
    // ======== AUTO MODE - APPLY LOGIC ========
    runAutoLogic();
  }

  // ======== APPLY ACTUATOR STATES ========
  setFan(fanOn);
  setPump(pumpOn);
  setLamp(lampOn);

  // ======== SEND ACTUATOR STATUS ========
  DynamicJsonDocument doc(256);
  doc["isOn"] = lampOn;
  String json;
  serializeJson(doc, json);
  sendToFirebase("/actuators/lamp/state", json);

  doc.clear();
  doc["isOn"] = fanOn;
  json = "";
  serializeJson(doc, json);
  sendToFirebase("/actuators/fan/state", json);

  doc.clear();
  doc["isOn"] = pumpOn;
  json = "";
  serializeJson(doc, json);
  sendToFirebase("/actuators/pump/state", json);

  Serial.println("===== STATUS =====");
  Serial.printf("Mode: %s\n", currentMode.c_str());
  Serial.printf("Lamp: %s | Fan: %s | Pump: %s\n", 
    lampOn ? "ON" : "OFF",
    fanOn ? "ON" : "OFF",
    pumpOn ? "ON" : "OFF"
  );
  Serial.println("==================\n");
}

// =======================
//   MANUAL MODE COMMANDS
// =======================
void readManualCommands() {
  // Baca lamp command
  String response;
  if (readFromFirebase("/actuators/lamp/command", response)) {
    DynamicJsonDocument doc(256);
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      if (doc.containsKey("isOn")) {
        lampOn = doc["isOn"].as<bool>();
      }
    }
  }

  // Baca fan command
  response = "";
  if (readFromFirebase("/actuators/fan/command", response)) {
    DynamicJsonDocument doc(256);
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      if (doc.containsKey("isOn")) {
        fanOn = doc["isOn"].as<bool>();
      }
    }
  }

  // Baca pump command
  response = "";
  if (readFromFirebase("/actuators/pump/command", response)) {
    DynamicJsonDocument doc(256);
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      if (doc.containsKey("isOn")) {
        pumpOn = doc["isOn"].as<bool>();
      }
    }
  }
}

// =======================
//   AUTO MODE LOGIC
// =======================
void runAutoLogic() {
  // Baca sensor terbaru
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) { h = 0; t = 0; }

  int soilRaw = analogRead(SOIL_PIN);
  float soilPercent = map(constrain(soilRaw, waterValue, airValue), waterValue, airValue, 100, 0);
  soilPercent = constrain(soilPercent, 0, 100);

  int ldrRaw = analogRead(LDR_PIN);
  float Vout = ldrRaw * (3.3 / 4095.0);
  Vout = constrain(Vout, 0.01, 3.29);
  float Rldr = (3.3 - Vout) * Rfixed / Vout;
  float R_k = max(Rldr / 1000.0, 0.1);
  float lux = 500.0 / pow(R_k, 1.4);

  // ======== LOGIKA AUTO ========
  fanOn  = (t > TEMP_HIGH || h < HUMID_LOW);
  pumpOn = (soilPercent < SOIL_LOW_PERCENT);
  lampOn = (lux < LUX_LOW);
}
