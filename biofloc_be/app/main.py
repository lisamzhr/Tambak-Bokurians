from fastapi import FastAPI
from app.database import ensure_indexes
from app.routers import ponds, sensor, manual, data, auth, ai

app = FastAPI(title="Biofloc Monitoring API")

app.include_router(auth.router)
app.include_router(ponds.router)
app.include_router(sensor.router)
app.include_router(manual.router)
app.include_router(data.router)
app.include_router(ai.router)


@app.on_event("startup")
def startup():
    ensure_indexes()


@app.get("/")
def root():
    return {"status": "ok", "message": "Biofloc Monitoring API jalan"}