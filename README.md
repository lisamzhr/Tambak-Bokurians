# Bokurians
- Aliya Syafiqa
- Dimas Andhika D.
- Khalisa Zahra M.
- Sekar Ayu K.

# 🌊 Tambak (AI Biofloc Monitoring Assistant)
**Empowering Smallholder Farmers with AI-Driven Precision Aquaculture.**

The **Tambak** project is an integrated digital solution designed to optimize biofloc shrimp and fish farming. By combining real-time sensor data, predictive analytics, and a 24/7 AI assistant, Tambak lowers the knowledge barrier for smallholder farmers and helps prevent harvest failure.

---

## 📖 Project Background

Biofloc technology is a sustainable aquaculture method, but it is highly sensitive to water quality fluctuations. Smallholder farmers often struggle with:
*   **Knowledge Gaps:** Complex decisions regarding dosing, feeding, and stocking.
*   **Delayed Detection:** Pond abnormalities often go unnoticed until it’s too late.
*   **Predictive Uncertainty:** Difficulty in estimating harvest timing and yield health.

**Tambak** addresses these challenges by transforming raw pond data into actionable insights through an "AI Health Score" and a conversational assistant, ensuring that even novice farmers can achieve professional-grade results.

---

## 🛠 Technical Specifications

The project is architected as a full-stack distributed system consisting of three primary modules: **AI Core**, **Backend Service**, and **Mobile Client**.

### 1. AI Core (`biofloc_ai`)
**Language:** Python  
The intelligence layer of the system, responsible for data processing and inference.
*   **Health Score Engine:** Utilizes machine learning models (likely Scikit-learn or TensorFlow) to analyze water parameters (pH, DO, Temp, Floc volume) and generate a real-time **Pond Health Score**.
*   **Harvest Predictor:** Time-series forecasting models to estimate harvest readiness based on growth rates and water stability.
*   **Tambak Assistant (NLP):** A conversational agent (powered by LLM/LangChain) that provides guidance on dosing and feeding strategies based on historical pond data and best practices.

### 2. Backend API (`biofloc_be`)
**Language:** TypeScript / Node.js  
The central nervous system that orchestrates data flow between sensors, the database, and the user interface.
*   **Architecture:** RESTful API design using Express.js or NestJS.
*   **Data Management:** Manages relational data for user profiles, pond histories, and real-time sensor logs.
*   **Integration:** Acts as a bridge for the AI Core to fetch live data and for the Mobile app to receive push notifications and dashboard updates.

### 3. Mobile Application (`biofloc_mobile`)
**Language:** TypeScript (React Native / Expo)  
The user-facing platform designed for accessibility in the field.
*   **Real-time Dashboard:** Visualizes water clarity, floc volume, and abnormalities through intuitive charts.
*   **Manual Entry System:** Allows farmers to input manual observations (e.g., visual water clarity) to augment sensor data.
*   **Assistant Interface:** A chat-based UI for interacting with the 24/7 AI guide.

---

## 📊 System Workflow

1.  **Data Collection:** Sensors and manual inputs feed water parameters into the **Backend**.
2.  **Analysis:** The **AI Core** processes this data to detect abnormalities and update the **AI Health Score**.
3.  **Action:** If a risk is detected, the **Mobile App** sends an alert. The farmer consults the **Tambak Assistant** for a specific dosing or feeding recommendation.
4.  **Prediction:** As the cycle progresses, the system provides a dynamic **Harvest Prediction** to help the farmer plan logistics.

---

## 🚀 Key Features
*   **Sensor-Manual Hybrid Monitoring:** Tracks floc volume and clarity in real-time.
*   **AI Health Score:** Instant "Water-Readiness" status for proactive management.
*   **24/7 AI Guide:** Expert-level support for dosing and stocking decisions.
*   **Predictive Analytics:** Data-driven harvest time estimations.

---

## 🛠 Tech Stack Summary
| Component | Technology |
| :--- | :--- |
| **Frontend** | React Native, TypeScript, Tailwind CSS |
| **Backend** | Node.js, TypeScript, PostgreSQL/MongoDB |
| **AI/ML** | Python, Pandas, Scikit-Learn, OpenAI API/LangChain |
| **Infrastructure** | Docker, Cloud Functions (GCP/AWS) |
