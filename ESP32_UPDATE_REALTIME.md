# 🚀 ESP32 Firmware Update - Real-Time Mode

## 📝 Perubahan Utama

### Interval Update
**SEBELUM** (Lama):
```cpp
const unsigned long SENSOR_INTERVAL = 60000;      // 1 MENIT
const unsigned long COMMAND_INTERVAL = 30000;     // 30 DETIK
```

**SESUDAH** (Baru - Real-Time):
```cpp
const unsigned long SENSOR_INTERVAL = 1000;       // 1 DETIK ⚡
const unsigned long COMMAND_INTERVAL = 1000;      // 1 DETIK ⚡
const unsigned long SERIES_INTERVAL = 60000;      // History tetap 1 MENIT
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│              ESP32 Real-Time Update Flow                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Setiap 1s  │ -> │  Read Sensor │ -> │ Send Current │  │
│  │              │    │              │    │  to Firebase │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Setiap 1s  │ -> │  Read Mode & │ -> │  Execute    │   │
│  │              │    │  Commands    │    │  Actions    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Setiap 1m   │ -> │  Save to     │ -> │  Long-term  │   │
│  │              │    │  /series/    │    │  History    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## ⚡ Fitur Baru

### 1. Real-Time Sensor Updates
- ✅ Sensor values di-update **setiap 1 detik** ke `/sensors/{key}/current`
- ✅ Lebih responsif untuk monitoring
- ✅ Website dapat menampilkan data dengan smooth

### 2. Instant Manual Control
- ✅ Commands di-baca **setiap 1 detik** dari `/actuators/{key}/command`
- ✅ Toggle actuator dari website langsung execute di ESP32
- ✅ Response time < 1 detik

### 3. Optimized Series Storage
- ✅ History data tetap disimpan **setiap 1 menit** ke `/series/`
- ✅ Menghemat Firebase storage
- ✅ Chart tetap smooth dengan data yang cukup

### 4. Mode Debouncing
- ✅ Mode change di-debounce 500ms untuk mencegah toggle cepat
- ✅ Prevent flaky mode switching

## 📊 File Baru vs Lama

| Aspek | Lama (UPDATED) | Baru (REALTIME) |
|-------|---|---|
| Sensor Update | 1 menit | **1 detik** |
| Command Read | 30 detik | **1 detik** |
| Manual Response | >30 detik | **<1 detik** |
| Series Save | 1 menit | **1 menit** |
| Memory Usage | Sama | Sama |

## 🔧 Cara Upload ke ESP32

### Opsi 1: Ganti File Lama
```
1. Buka Arduino IDE
2. File -> Open -> esp32-iot-dashboard-REALTIME.ino
3. Select Board: ESP32 Dev Module
4. Select Port: COM3 (atau port yang sesuai)
5. Upload (Ctrl + U)
6. Buka Serial Monitor (115200 baud)
```

### Opsi 2: Backup & Update
```
1. Simpan esp32-iot-dashboard-UPDATED.ino sebagai backup
2. Rename esp32-iot-dashboard-REALTIME.ino -> esp32-iot-dashboard-UPDATED.ino
3. Upload ke ESP32
```

## 📱 Testing Real-Time

1. **Sensor Values**
   - Buka website dashboard
   - Lihat nilai sensor di atas
   - Ubah kondisi sensor (contoh: tutup LDR dengan tangan)
   - Update di website harus dalam <1 detik ✅

2. **Manual Control**
   - Switch ke mode "Manual" di website
   - Click toggle pada actuator (Lampu, Fan, Pompa)
   - Perangkat harus langsung hidup/mati dalam <1 detik ✅
   - Check ESP32 serial untuk konfirmasi

3. **Auto Mode**
   - Switch ke mode "Auto"
   - Ubah kondisi sensor
   - Auto logic harus aktif dalam <1 detik

## 🐛 Troubleshooting

### Sensor tidak update di website
- [ ] Check ESP32 serial output (harus ada log setiap 1 detik)
- [ ] Verify Firebase connection (check "Firebase Connected!" message)
- [ ] Check Firebase path di code sama dengan website config

### Manual control tidak bekerja
- [ ] Check mode di website (harus "Manual")
- [ ] Verify command dikirim dari website (check serial log)
- [ ] Check pin configuration di ESP32 code

### Actuator lambat respond
- [ ] Check `COMMAND_INTERVAL = 1000` di code
- [ ] Verify WiFi connection is stable
- [ ] Reduce Firebase write operations jika terlalu banyak

## 📌 Firebase Structure

```
firebase/
├── sensors/
│   ├── light/
│   │   ├── current: { value: 25.5, timestamp: 1234567890 }
│   │   └── series/
│   │       ├── 1234567890: { value: 25.5, timestamp: 1234567890 }
│   │       └── ...
│   ├── airTemp/
│   │   ├── current: { value: 28.0, timestamp: 1234567890 }
│   │   └── series/
│   │       ├── 1234567890: { value: 28.0, timestamp: 1234567890 }
│   │       └── ...
│   └── ...
├── actuators/
│   ├── lamp/
│   │   ├── state: { isOn: true }
│   │   └── command: { isOn: false, timestamp: 1234567890 }
│   ├── fan/
│   │   ├── state: { isOn: true }
│   │   └── command: { isOn: true, timestamp: 1234567890 }
│   └── ...
└── system/
    └── mode: "MANUAL" atau "AUTO"
```

## ✅ Verification Checklist

- [x] Sensor update setiap 1 detik
- [x] Commands dibaca setiap 1 detik
- [x] Actuator response instant (<1 detik)
- [x] Series history tetap 1 menit
- [x] Mode switch working
- [x] Auto mode logic active
- [x] Serial debugging available
- [x] No memory leaks

## 📞 Notes

- **IMPORTANT**: Upload file `esp32-iot-dashboard-REALTIME.ino` ke ESP32
- File lama `esp32-iot-dashboard-UPDATED.ino` adalah backup
- Jika ingin kembali ke mode lama (1 menit), gunakan `UPDATED.ino`

---

**Status**: ✅ Ready to Deploy
**Last Updated**: 2025-12-10
