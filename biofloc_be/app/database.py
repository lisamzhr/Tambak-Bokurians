from pymongo import MongoClient, ASCENDING
from pymongo.server_api import ServerApi
from app.config import settings

client = MongoClient(settings.mongo_uri, server_api=ServerApi("1"))
db = client[settings.mongo_db_name]

ponds_col = db["ponds"]
readings_col = db["readings_buckets"]
profiles_col = db["profiles"]
users_col = db["users"]
token_blacklist_col = db["token_blacklist"]


def ensure_indexes():
    # BUKAN unique lagi -- satu pond_id sekarang boleh punya BANYAK dokumen
    # bucket (tiap bucket max 300 reading). Index ini buat mempercepat query
    # upsert di push_reading() (cari bucket pond_id ini yang count < 300)
    # dan query range waktu di get_readings().
    readings_col.create_index([("pond_id", ASCENDING), ("count", ASCENDING)])
    readings_col.create_index([("pond_id", ASCENDING), ("first_ts", ASCENDING)])

    ponds_col.create_index("pond_id", unique=True)
    profiles_col.create_index("profile_id", unique=True)
    users_col.create_index("username", unique=True)

    token_blacklist_col.create_index("expires_at", expireAfterSeconds=0)