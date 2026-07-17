# 🌊 Tambak — AI Biofloc Monitoring Assistant

> **Empowering Smallholder Farmers with AI-Driven Precision Aquaculture**

**Team Bokurians**
| Member |
|---|
| Aliya Syafiqa |
| Dimas Andhika D. |
| Khalisa Zahra M. |
| Sekar Ayu K. |

---

## 📖 Table of Contents

1. [Background](#-background)
2. [Problem Analysis](#-problem-analysis)
3. [Solution](#-solution)
4. [System Architecture](#-system-architecture)
5. [Technical Specifications](#-technical-specifications)
   - [AI Core (`biofloc_ai`)](#1-ai-core-biofloc_ai)
   - [Backend API (`biofloc_be`)](#2-backend-api-biofloc_be)
   - [Mobile Application (`biofloc_mobile`)](#3-mobile-application-biofloc_mobile)
6. [API Reference](#-api-reference)
7. [Database Schema](#-database-schema)
8. [AI Engine Details](#-ai-engine-details)
9. [Water Quality Parameters](#-water-quality-parameters)
10. [Getting Started](#-getting-started)
11. [Impact & Market](#-impact--market)

---

## 🌍 Background

Indonesia is one of the world's largest aquaculture producers, but smallholder shrimp and fish farmers — who account for the majority of production volume — operate largely without scientific tools. **Biofloc Technology (BFT)** is a sustainable, high-yield aquaculture method that grows beneficial microbial communities directly inside pond water to recycle waste nitrogen and serve as a supplemental food source. It dramatically reduces water exchange requirements and feed costs.

However, BFT is **biologically complex and highly sensitive** to water chemistry fluctuations. Unlike conventional ponds, a biofloc system lives and breathes — its microbial population must reach "maturity" before fish or shrimp can safely be stocked, and it requires constant parameter monitoring throughout the crop cycle.

Traditional farmers rely on:
- **Visual water color** to estimate biofloc maturity (highly inaccurate)
- **Intuition and experience** for carbon dosing and feeding decisions
- **Delayed detection** of ammonia spikes or nitrite blooms — often only noticed after mass mortality begins

A single crop failure in a standard 50 m³ biofloc pond can cost smallholders up to **Rp 15,000,000** in lost seed and feed investment.

---

## 🔬 Problem Analysis

### Critical Pain Points

| Challenge | Impact |
|---|---|
| **Immature bacterial system at stocking** | Up to **80%** of seed mortality in the first 7 days due to ammonia toxic shock |
| **Unmonitored ammonia spikes (NH₃ > 0.05 mg/L)** | Sudden mass die-off; invisible until too late |
| **Toxic nitrite blooms** | Chronic stress, reduced growth rate, secondary infection |
| **No C:N ratio tracking** | Suboptimal biofloc formation; feed efficiency (FCR) loss |
| **Feed cost burden** | Feed constitutes **> 60%** of total production cost with no optimization feedback |
| **Biological Asymmetry** | Buyers lack reliable access to true livestock health data |

### A Farmer's Biofloc Preparation Journey (Traditional)

```
Pond Preparation          Seed Stocking          Daily Feeding
(fill water, dolomite,  → (no maturity check) → (no C:N tracking) → ⚠️ Crisis
 probiotic)               Visual "water check"   based on instinct
```

**Best case:** Healthy pond with thriving tilapia/shrimp  
**Worst case:** Ammonia/nitrite crash → partial or total crop loss

---

## 💡 Solution

**Tambak** is an integrated AI-powered biofloc monitoring platform that transforms raw pond data into actionable, real-time guidance. It answers the core question:

> *"How can a farmer verify pond readiness and biofloc maturity before stocking, so they can manage water parameters safely, precisely, and scientifically?"*

### Three Pillars of Tambak

```
┌─────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│   Smart Monitoring  │   │  AI Health Dashboard  │   │  Expert AI Guidance │
│                     │   │                       │   │                     │
│  Sensor + manual    │   │  Instant water-       │   │  Always-on support  │
│  tracking of floc   │   │  readiness status +   │   │  for dosing,        │
│  volume, water      │   │  predictive harvest   │   │  feeding, and       │
│  clarity & health   │   │  time analytics       │   │  stocking decisions │
└─────────────────────┘   └──────────────────────┘   └─────────────────────┘
```

### Key Capabilities

- 🔬 **Biofloc Maturity Verification** — Scientifically determine if pond is ready for stocking before any seed is added
- 📊 **Real-time Water Parameter Dashboard** — pH, DO, temperature, ammonia, nitrite, nitrate, TSS tracked continuously
- 🤖 **AI Diagnose** — Instant rule-based + ML-based health assessment of current pond conditions
- ⚙️ **AI Setup Recommendations** — Species-specific stocking density, carbon dosing, inoculum guidance
- 📈 **Predictive Analytics** — Trend forecasting and harvest timing estimation
- 📲 **Hybrid Input** — Supports both automated IoT sensor feeds and manual farmer data entry

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Mobile App (Expo/RN)                        │
│  Kolam List → Pond Detail → [Grafik | Input | AI Diagnosa | Setup] │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ REST API (JWT Auth)
┌──────────────────────────────▼─────────────────────────────────────┐
│                     Backend API (FastAPI / Python)                  │
│  /auth  /ponds  /sensor  /manual  /data  /ponds/{id}/ai-*          │
└──────────┬──────────────────────────────────────────┬──────────────┘
           │                                           │
┌──────────▼──────────┐                   ┌───────────▼──────────────┐
│   MongoDB Atlas      │                   │     AI Core (Python)     │
│  - ponds             │                   │  setup_recommendation    │
│  - readings_buckets  │◄──── CSV export ──│  maturity_check          │
│  - profiles          │                   │  predict_health          │
│  - users             │                   │  diagnose_now            │
│  - token_blacklist   │                   └──────────────────────────┘
└─────────────────────┘
```

### Data Flow

1. **Ingest** — IoT sensor readings pushed via `POST /sensor/data` or farmer manual entry via `POST /manual/data`
2. **Store** — Readings stored in MongoDB using the **Bucket Pattern** (up to 300 readings per document for time-series efficiency)
3. **Analyze** — AI endpoints export pond data to a temporary CSV, execute AI Python scripts as subprocesses, and return JSON results
4. **Display** — Mobile app presents live charts, health scores, and AI recommendations to the farmer

---

## 🛠 Technical Specifications

### 1. AI Core (`biofloc_ai`)

**Language:** Python  
**Location:** `./biofloc_ai/`

The intelligence layer, responsible for all ML inference, rule-based diagnosis, and biofloc maturity assessment.

#### Dependencies

```
pandas         # Data manipulation & CSV processing
numpy          # Numerical computation
scikit-learn   # Random Forest Regression model training & prediction
joblib         # Model serialization (.pkl files)
```

#### Module Structure

| File | Purpose |
|---|---|
| `src/config.py` | Safety thresholds (from peer-reviewed literature: Wasielesky et al. 2026) |
| `src/profiles.py` | Species profile loader (JSON-based, supports `generic` auto-threshold mode) |
| `src/feature_engineering.py` | Derives risk flags, rolling averages, and trend features from raw data |
| `src/prepare_data.py` | Cleans and normalizes raw CSV input for model consumption |
| `src/prepare_WQD.py` | Prepares Aquaculture Water Quality Datasets for training |
| `src/train_model.py` | Trains Random Forest Regression models per species profile |
| `src/predict_health.py` | **Endpoint 3 script** — ML health score prediction from historical data |
| `src/diagnose_now.py` | **Endpoint 4 script** — Rule-based instant diagnosis from latest readings |
| `src/maturity_check.py` | **Endpoint 2 script** — Multi-phase biofloc maturity assessment |
| `src/setup_recommendation.py` | **Endpoint 1 script** — Stocking, inoculum, and carbon dosing calculator |
| `src/derive_thresholds.py` | Derives adaptive thresholds from raw data using percentile analysis |

#### Algorithm

- **Health Prediction:** Random Forest Regression (Supervised ML) trained on *Aquaculture Water Quality Datasets* (Mendeley Data) and *Aquaponics Fish Pond Datasets* (Kaggle)
- **Maturity Check:** Multi-phase rule engine evaluating nitrification cycle completion, TSS stability, ammonia conversion rate, and stocking readiness timeline
- **Diagnose:** Threshold-based rule engine with configurable `warning/danger` bands per parameter, per species
- **Setup:** Formula-based calculator using species volume density targets, C:N ratio requirements, and inoculum dosage calculations

#### Species Profiles

Profiles are stored as JSON files in `biofloc_ai/profiles/`:
- `tilapia_freshwater.json` — *Oreochromis niloticus* (Nila)
- `vannamei_marine.json` — *Penaeus vannamei* (Udang Vaname)
- `generic` — Auto-adaptive mode using percentile-based thresholds from the pond's own historical data (no literature required)

---

### 2. Backend API (`biofloc_be`)

**Language:** Python  
**Framework:** FastAPI 0.115.0  
**Server:** Uvicorn  
**Location:** `./biofloc_be/`

The central orchestration layer bridging the mobile client, database, and AI core.

#### Dependencies

```
fastapi==0.115.0          # API framework
uvicorn[standard]==0.30.6 # ASGI server
pymongo==4.8.0            # MongoDB driver
pydantic==2.9.2           # Data validation & schemas
pydantic-settings==2.5.2  # .env settings management
python-dotenv==1.0.1      # Environment variable loading
passlib[bcrypt]==1.7.4    # Password hashing
python-jose[cryptography]==3.3.0  # JWT token signing
python-multipart==0.0.9   # Form data parsing
pandas==2.2.2             # Data export to temp CSV for AI scripts
```

#### Routers

| Router | Prefix | Description |
|---|---|---|
| `auth.py` | `/auth` | Login, logout, JWT token management |
| `ponds.py` | `/ponds` | CRUD for pond management (per-user ownership) |
| `sensor.py` | `/sensor` | Automated IoT sensor data ingestion endpoint |
| `manual.py` | `/manual` | Manual farmer data entry endpoint |
| `data.py` | `/ponds/{id}/readings` | Time-series reading retrieval with date range filtering |
| `ai.py` | `/ponds/{id}/ai-*` | All AI inference endpoints |

#### Authentication

- **JWT Bearer Token** authentication on all protected routes
- Token blacklist maintained in MongoDB with TTL index for automatic expiry cleanup
- Passwords hashed using `bcrypt`

---

### 3. Mobile Application (`biofloc_mobile`)

**Language:** TypeScript  
**Framework:** React Native 0.86.0 + Expo 57  
**Router:** Expo Router (file-based routing)  
**Location:** `./biofloc_mobile/`

#### Key Dependencies

```json
{
  "expo": "~57.0.6",
  "react-native": "0.86.0",
  "expo-router": "~57.0.6",
  "react-native-svg": "15.15.4",
  "react-native-safe-area-context": "~5.7.0",
  "react-native-reanimated": "4.5.0",
  "@expo/vector-icons": "^15.0.2",
  "@react-native-async-storage/async-storage": "2.2.0"
}
```

#### Application Structure

```
src/
├── app/
│   ├── index.tsx              # Login / onboarding
│   └── (dashboard)/
│       ├── _layout.tsx        # Dashboard root + bottom nav
│       ├── kolam.tsx          # Pond list screen
│       ├── tambah-kolam.tsx   # Add new pond form
│       └── pond/
│           └── [pond_id].tsx  # Pond detail (tabs: Grafik, Input, AI)
├── context/
│   └── AuthContext.tsx        # JWT auth state management
└── services/
    ├── api.ts                 # Axios base configuration
    ├── auth.service.ts        # Login/logout API calls
    ├── ponds.service.ts       # Pond CRUD API calls
    ├── readings.service.ts    # Sensor + manual reading API calls
    └── ai.service.ts          # AI endpoint API calls
```

#### Pond Detail Tabs

| Tab | Icon | Description |
|---|---|---|
| **Grafik** | `bar-chart` | SVG line charts for all 7 water parameters + latest reading summary card |
| **Input** | `edit` | Manual data entry form with segmented control (Manual / Sensor info) |
| **AI Diagnosa** | `psychology` | Real-time rule-based diagnosis of current water condition |
| **AI Setup** | `tune` | Stocking density, inoculum, and carbon dosing recommendations |
| **AI Maturitas** | `opacity` | Biofloc maturity assessment and stocking readiness report |

#### Design System

- **Primary color:** `#006a65` (teal)
- **Background pattern:** Faded `logo_tambak.jpeg` watermark (opacity: 0.15) as per-screen brand element
- **Bottom tab bar** with safe area inset support for iOS/Android
- **Custom SVG line charts** — no external charting library; built in-house using `react-native-svg`
- **Segmented control** for input mode switching (Manual entry / IoT Sensor info)

---

## 📡 API Reference

### Authentication

```http
POST /auth/login
Content-Type: application/json

{ "username": "farmer01", "password": "secret" }
→ { "access_token": "eyJ...", "token_type": "bearer" }

POST /auth/logout
Authorization: Bearer <token>
```

### Ponds

```http
GET    /ponds                  # List user's ponds
POST   /ponds                  # Register new pond
GET    /ponds/{pond_id}        # Get single pond detail
```

### Data Ingestion

```http
POST /sensor/data
{ "pond_id": "ponds-nila-01", "timestamp": "...", "ph": 7.5, "do_mg_l": 6.5, ... }

POST /manual/data
{
  "pond_id": "ponds-udang-01",
  "timestamp": "2026-07-17T10:00:00+00:00",
  "ph": 7.6,
  "temperature_c": 26.0,
  "do_mg_l": 6.5,
  "ammonia_mg_l": 0.8,
  "nitrite_mg_l": 1.5,
  "nitrate_mg_l": 40.0,
  "TSS_mg_l": 200
}
```

### Readings Query

```http
GET /ponds/{pond_id}/readings?from=2026-07-10&to=2026-07-17
→ {
    "pond_id": "...",
    "date_from": "...",
    "date_to": "...",
    "count": 21,
    "readings": [ { "ts": "...", "ph": 7.5, ... } ]
  }
```

### AI Endpoints

```http
GET /ponds/{pond_id}/ai-setup      # Setup & stocking recommendations
GET /ponds/{pond_id}/ai-maturity   # Biofloc maturity check
GET /ponds/{pond_id}/ai-health     # ML-based health score prediction
GET /ponds/{pond_id}/ai-diagnose   # Rule-based instant diagnosis
```

All endpoints require `Authorization: Bearer <token>` and enforce **per-user pond ownership**.

---

## 🗄 Database Schema

**Database:** MongoDB Atlas  
**Pattern:** Bucket Pattern for time-series efficiency (max 300 readings per bucket document)

### Collections

#### `ponds`
```json
{
  "pond_id": "ponds-nila-01",
  "name": "Kolam Nila Utara",
  "profile_id": "tilapia_freshwater",
  "volume_liters": 1000,
  "owner_username": "farmer01",
  "created_at": "2026-07-01T00:00:00Z"
}
```

#### `readings_buckets` (Bucket Pattern)
```json
{
  "pond_id": "ponds-nila-01",
  "first_ts": "2026-07-10T08:00:00Z",
  "count": 21,
  "readings": [
    {
      "ts": "2026-07-10T08:00:00Z",
      "source": "manual",
      "ph": 7.51,
      "temperature_c": 26.4,
      "do_mg_l": 6.65,
      "ammonia_mg_l": 2.5,
      "nitrite_mg_l": 8.438,
      "nitrate_mg_l": 30.9,
      "TSS_mg_l": 297.0
    }
  ]
}
```

#### `users`
```json
{ "username": "farmer01", "hashed_password": "$2b$...", "created_at": "..." }
```

#### `profiles`
```json
{ "profile_id": "tilapia_freshwater", "species": "Oreochromis niloticus", ... }
```

### Indexes

| Collection | Index | Type |
|---|---|---|
| `readings_buckets` | `(pond_id, count)` | Compound |
| `readings_buckets` | `(pond_id, first_ts)` | Compound |
| `ponds` | `pond_id` | Unique |
| `profiles` | `profile_id` | Unique |
| `users` | `username` | Unique |
| `token_blacklist` | `expires_at` | TTL (auto-cleanup) |

---

## 🤖 AI Engine Details

### Safety Thresholds (from peer-reviewed literature)

> Source: Wasielesky et al. 2026, *"Determining the Minimum Mature Inoculum Requirement for Nitrification Efficiency and Enhanced Zootechnical Performance of Penaeus vannamei in BFT System"*, Aquaculture Journal 6(1):6

| Parameter | Warning Threshold | Danger Threshold | Action |
|---|---|---|---|
| **Ammonia (TAN)** | > 2.0 mg/L | > 3.95 mg/L | Immediate water exchange |
| **Nitrite** | — | > 25.7 mg/L | 30% water change (SOP) |
| **Nitrite (action)** | > 20.0 mg/L | — | Pre-emptive intervention |
| **Nitrate** | — | > 300.0 mg/L | Dilution required |

### Normal Operating Ranges (Successful Treatment, Table 3)

| Parameter | Normal Range |
|---|---|
| Temperature | 25.0 – 27.0 °C |
| Dissolved Oxygen (DO) | 6.2 – 6.9 mg/L |
| pH | 7.3 – 8.0 |
| Alkalinity | 150 – 225 mg/L |
| TSS (inoculum) | 5.0 – 20.0 mg/L |

### C:N Ratio Target

**15:1** — Carbon-to-Nitrogen ratio required to stimulate heterotrophic bacterial growth. Carbon source (molasses/glucose) is dosed to maintain this ratio as nitrogen is added via feeding.

### Classification Logic

- **Directional parameters** (ammonia, nitrite, nitrate): `safe → warning → danger` as value increases
- **Range parameters** (pH, DO, temperature): `safe` within normal band, `warning` within 15% tolerance, `danger` outside tolerance
- **Generic profile**: Thresholds auto-computed from historical data percentiles (p5/p25/p75/p95) when no species literature profile exists

### Training Data

| Dataset | Source |
|---|---|
| Aquaponics Fish Pond Datasets | Kaggle (devang03mgr) |
| Aquaculture - Water Quality Datasets | Mendeley Data (y78ty2g293/1) |

---

## 💧 Water Quality Parameters

All 7 water quality parameters tracked by Tambak:

| Parameter | Unit | Significance |
|---|---|---|
| **pH** | — | Indicator of water acidity/alkalinity; affects bacterial activity and fish gill function |
| **Temperature** | °C | Controls metabolic rates of fish, shrimp, and biofloc bacteria |
| **Dissolved Oxygen (DO)** | mg/L | Critical for aerobic respiration; low DO is a primary mortality trigger |
| **Ammonia (NH₃/NH₄⁺)** | mg/L | Primary nitrogenous waste; toxic at high concentrations |
| **Nitrite (NO₂⁻)** | mg/L | Intermediate nitrification product; causes "brown blood disease" |
| **Nitrate (NO₃⁻)** | mg/L | Final nitrification product; accumulates over time; diluted by water exchange |
| **TSS** | mg/L | Total Suspended Solids; primary measure of biofloc concentration |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB Atlas connection string
- Expo Go app (for mobile development)

### 1. AI Core Setup
```bash
cd biofloc_ai
pip install -r requirements.txt

# Train models (first-time setup)
python src/train_model.py
```

### 2. Backend API Setup
```bash
cd biofloc_be
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Set: MONGO_URI, MONGO_DB_NAME, SECRET_KEY, AI_SRC_DIR

# Seed species profiles
python app/seed_profiles.py

# Start server
uvicorn app.main:app --reload
```

### 3. Mobile App Setup
```bash
cd biofloc_mobile
npm install

# Set API base URL in src/services/api.ts
# Start development server
npx expo start
```

---

## 📊 Impact & Market

### Market Sizing (Indonesia)

| Segment | Size |
|---|---|
| **TAM** (Total Addressable Market) | IDR 120 Trillion |
| **SAM** (Serviceable Available Market) | IDR 18 Trillion |
| **SOM** (Serviceable Obtainable Market) | IDR 5.9 Million |

### 5-Year Projections

- Break-Even Point: **Year 2** (500 active sellers)
- LTV/CAC Ratio: **160.1×** by Year 5
- Gross Margin target: **80%**
- Net Income Margin target: **54.2%** by Year 5
- Economic Impact (GMV processed): **IDR 210 Billion** by Year 5

### Competitive Advantage

| System | Limitation |
|---|---|
| Conventional (Manual/Instinct) | Guesswork, late disease detection, inconsistent results |
| Generic IoT Platforms | Raw sensor data only, no biofloc-specific model |
| Aquaculture Consultants | Accurate but expensive, not real-time |
| **Tambak** ✅ | AI-powered, biofloc-specific, real-time, affordable |

### SDG Alignment

Tambak contributes to **4 of 17 SDGs**: Zero Hunger, Good Health, Decent Work & Economic Growth, and Responsible Consumption & Production.

---

## 🏆 Tech Stack Summary

| Component | Technology |
|---|---|
| **Mobile Frontend** | React Native 0.86, TypeScript, Expo 57, Expo Router |
| **Charts** | Custom SVG (react-native-svg) — no external charting library |
| **Backend** | Python, FastAPI, Uvicorn |
| **Database** | MongoDB Atlas (Bucket Pattern for time-series) |
| **AI/ML** | Python, Pandas, NumPy, Scikit-learn (Random Forest Regression), Joblib |
| **Auth** | JWT (python-jose), bcrypt password hashing |
| **AI Integration** | Subprocess-based Python script execution with JSON stdout capture |

---

*Made with ❤️ by Team Bokurians — Tambak, AI Biofloc Monitoring Assistant*
