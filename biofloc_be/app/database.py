from pymongo import MongoClient, ASCENDING
from pymongo.server_api import ServerApi
from app.config import settings

client = MongoClient(settings.mongo_uri, server_api=ServerApi("1"))
db = client[settings.mongo_db_name]

ponds_col = db["ponds"]
readings_col = db["readings_buckets"]
profiles_col = db["profiles"]
users_col = db["users"]


def ensure_indexes():
    readings_col.create_index([("pond_id", 1), ("first_ts", 1)])
    ponds_col.create_index("pond_id", unique=True)
    profiles_col.create_index("profile_id", unique=True)
    users_col.create_index("username", unique=True)