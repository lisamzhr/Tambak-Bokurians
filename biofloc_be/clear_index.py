# clear_index.py
from app.database import readings_col

print("⏳ Menghapus Unique Index 'pond_id_1_date_1' dari MongoDB...")
try:
    readings_col.drop_index("pond_id_1_date_1")
    print("✅ Berhasil menghapus index unik lama!")
except Exception as e:
    print(f"ℹ️ Info: Index tidak ditemukan atau sudah terhapus: {e}")

print("🧹 Mengosongkan sisa data bucket lama agar bersih total...")
readings_col.delete_many({})
print("✅ Koleksi data dibersihkan.")