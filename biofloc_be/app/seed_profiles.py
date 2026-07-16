"""
Jalanin sekali: python -m app.seed_profiles
Baca semua .json di PROFILES_DIR (dari .env) dan upsert ke database.
"""
import json
from pathlib import Path
from app.database import profiles_col, ensure_indexes
from app.config import settings


def _resolve_profiles_dir() -> Path:
    p = Path(settings.profiles_dir)
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    return p


def seed():
    ensure_indexes()
    profiles_dir = _resolve_profiles_dir()
    if not profiles_dir.is_dir():
        print(f"❌ Folder profiles gak ketemu di: {profiles_dir}")
        return

    for file_path in profiles_dir.glob("*.json"):
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            profile_id = data["profile_id"]
            profiles_col.update_one(
                {"profile_id": profile_id}, {"$set": data}, upsert=True
            )
            print(f"✅ Berhasil seed profile ke database: {profile_id}")
        except Exception as e:
            print(f"❌ Gagal membaca/seed file {file_path.name}: {e}")


if __name__ == "__main__":
    seed()