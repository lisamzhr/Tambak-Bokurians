# simulate_iot.py
import time
import random
import requests
from datetime import datetime, timezone, timedelta

# ==================== CONFIGURATION ====================
BASE_URL = "http://127.0.0.1:8000"
POND_ID = "ponds-nila-01"
TOTAL_DATA = 500  # Menginjeksi 500 data (otomatis terbagi jadi 2 bucket di MongoDB)

# 🔑 Masukkan API Key sensor kamu di sini. 
# Cek nilainya di file .env kamu (bagian SENSOR_API_KEY) atau config.py
X_API_KEY = "rahasia-iot-device-123" 
# =======================================================

def generate_iot_stream():
    # Menggunakan header X-API-Key sesuai kebutuhan router backend kamu
    headers = {
        "X-API-Key": X_API_KEY,
        "Content-Type": "application/json"
    }
    
    # URL tepat menuju router sensor
    url = f"{BASE_URL}/sensor/data" 
    
    print(f"🚀 Memulai injeksi {TOTAL_DATA} data IoT ke endpoint /sensor/data untuk {POND_ID}...")
    
    # Hitung mundur waktu agar data tersimulasi runut per detik ke masa sekarang
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(seconds=TOTAL_DATA)
    
    success_count = 0
    
    for i in range(TOTAL_DATA):
        simulated_ts = start_time + timedelta(seconds=i)
        
        # Susun payload sesuai skema ReadingIn (termasuk pond_id didalamnya)
        payload = {
            "pond_id": POND_ID, # Wajib masuk body JSON
            "timestamp": simulated_ts.isoformat(),
            "ph": round(random.uniform(7.2, 7.8), 2),
            "temperature_c": round(random.uniform(26.5, 28.0), 1),
            "do_mg_l": round(random.uniform(5.8, 6.6), 2),
            "ammonia_mg_l": round(random.uniform(0.05, 0.25), 2),
            "nitrite_mg_l": round(random.uniform(0.01, 0.05), 3),
            "nitrate_mg_l": round(random.uniform(10.0, 20.0), 1),
            "TSS_mg_l": random.randint(120, 160)
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                success_count += 1
                if success_count % 50 == 0:
                    print(f"⚡ Berhasil mengirim {success_count}/{TOTAL_DATA} data...")
            else:
                print(f"❌ Gagal di data ke-{i}: Status {response.status_code} - {response.text}")
                break # Berhenti jika ada error credential agar hemat resource
                
        except Exception as e:
            print(f"💥 Koneksi error pada data ke-{i}: {e}")
            break

    print(f"\n✅ Selesai! Berhasil menginjeksi {success_count} data sensor per detik.")
    if success_count > 0:
        print("Silakan cek MongoDB Atlas atau tembak kembali endpoint /features dan /ai-health kamu!")

if __name__ == "__main__":
    if X_API_KEY == "MASUKKAN_SENSOR_API_KEY_KAMU_DISINI":
        print("🛑 ERROR: Tolong isi variabel X_API_KEY dengan nilai key device dari file .env milikmu!")
    else:
        generate_iot_stream()