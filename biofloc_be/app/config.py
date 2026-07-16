from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "biofloc_db"
    sensor_api_key: str = "ganti-dengan-key-rahasia"
    ai_src_dir: str = "../biofloc_ai/src"

    # JWT auth
    jwt_secret: str = "54c3e3fe9b15699eba9fe9dc448b16e251daf240b9dfd045ff65767eaf7211f1"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # token valid 1 hari

    # Parameter yang boleh masuk sebagai reading (dipakai validasi & bucket)
    allowed_fields: list[str] = [
        "ammonia_mg_l",
        "nitrite_mg_l",
        "nitrate_mg_l",
        "do_mg_l",
        "ph",
        "temperature_c",
        "alkalinity_mg_l",
        "TSS_mg_l",
    ]

    # Tambahkan baris ini untuk menampung path dari .env
    profiles_dir: str = "../biofloc_ai/profiles"

    class Config:
        env_file = ".env"


settings = Settings()