# test_connection.py
"""Step 1: tes koneksi ke MongoDB Atlas doang, gak nyentuh app/ dulu.
Jalanin: python test_connection.py
"""
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

load_dotenv()  # baca file .env

uri = os.getenv("MONGO_URI")
db_name = os.getenv("MONGO_DB_NAME", "biofloc_db")

if not uri:
    raise SystemExit("MONGO_URI belum diisi di .env")

client = MongoClient(uri, server_api=ServerApi("1"))

try:
    client.admin.command("ping")
    print("Berhasil konek ke MongoDB Atlas!")
    print(f"Database yang dipakai: {db_name}")
    print("Collection yang sudah ada:", client[db_name].list_collection_names())
except Exception as e:
    print("Gagal konek:", e)