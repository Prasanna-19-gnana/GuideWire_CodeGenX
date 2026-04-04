## Project Title

ZyroSafe - AI-Powered Parametric Insurance for Food Delivery Partners

## About the Project

ZyroSafe started from a simple problem: delivery partners can lose a meaningful part of their weekly income when the city becomes unsafe or unworkable because of rain, heat, or social disruption. I wanted to build something that reacted to those conditions automatically instead of forcing people through a slow manual claims process.

While building it, I learned how to connect a React UI to a Node.js backend, how to persist business actions in MongoDB Atlas, how to use live location and weather data responsibly, and how to trigger payouts only when the rules are satisfied. I also learned that reliability matters as much as features: duplicate accounts, backend restarts, and Node version mismatches all had to be handled before the system could feel stable.

The project was built as a full-stack parametric insurance workflow with a live dashboard, fraud scoring, disruption detection, and automated payout handling. The core idea is to estimate compensation from lost working time instead of waiting for manual assessment:

$$
  ext{Payout} = \max\left(₹50, \frac{\text{Weekly Income}}{\text{Working Hours}} \times \text{Lost Hours} \times \text{Plan Factor}\right)
$$

The biggest challenges were making the backend the single source of truth, keeping user actions stored in MongoDB Atlas, syncing live map movement with fraud checks, and keeping the UI responsive while the app handled notifications, support pages, and payout flows.

## Built With

React, Vite, Node.js, Express, MongoDB Atlas, Leaflet, React-Leaflet, Tailwind CSS, Motion, Razorpay, Lucide React, Nodemailer

📌 Overview
ZyroSafe is an automated parametric insurance platform designed to protect **food delivery partners** (e.g., Swiggy, Zomato) from income loss caused by environmental and social disruptions.

Unlike traditional insurance systems that rely on manual claims and damage assessment, ZyroSafe uses **real-time external data and rule-based logic** to trigger **instant payouts**.

👤 Target User Persona
A food delivery partner who:
    - Earns income based on completed deliveries  
    - Works ~8–10 hours per day  
    - Depends on real-time operational conditions  
    - Faces immediate income loss during disruptions

# 🎯 Problem Statement
Food delivery partners lose **20–30% of weekly income** due to:

  - Heavy rainfall affecting delivery operations  
  - Extreme heat making outdoor work unsafe  
  - Cyclones and storms disrupting city activity  
  - Curfews and strikes restricting movement  

Traditional insurance fails because:
  - It requires manual claims  
  - It focuses on asset damage, not income loss  
  - It is too slow for daily earning disruptions  

🚀 Proposed Solution
ZyroSafe implements a **parametric insurance model** where payouts are automatically triggered based on disruption thresholds.

  The system:
    - Monitors real-time environmental and event data  
    - Validates disruption conditions  
    - Calculates payouts based on **estimated income loss**  

⚙️ Disruption Detection Parameters

  🌧️ Rainfall
    -  45–60 mm/day → Moderate disruption  
    -  >60 mm/day → Severe disruption  
  
  ☀️ Extreme Heat
    - Temperature > 45°C  
  
  🌪️ Cyclones & Storms
    - Official alerts trigger full disruption  
  
  🚫 Social Disruptions
    - Curfews  
    - Strikes  
    - Zone closures  

All triggers are validated using **trusted external APIs**.


💰 Insurance Plans
  
 | Plan     | Premium | Plan Factor |
 |----------|---------|-------------|
 | Basic    | 5%      | 0.8         |
 | Standard | 7%      | 1.0         |
 | Premium  | 10%     | 1.2         |
      
Premiums are calculated on a **weekly basis**.

💸 Payout Model (Income-Based & Scalable)

ZyroSafe calculates payouts based on "**actual income loss**".

🧠 Core Formula
Payout = max(Minimum Payout, Hourly Income × Lost Hours × Plan Factor)

---

### 🔍 Definitions

- **Hourly Income** = Weekly Income / Total Working Hours  
- **Lost Hours** = Estimated hours affected by disruption  
- **Plan Factor**:
  - Basic → 0.8  
  - Standard → 1.0  
  - Premium → 1.2  

---

### 📉 Minimum Payout (Dynamic)
Minimum Payout = max(₹50, Weekly Income × 0.01)

This ensures meaningful payouts while maintaining sustainability.

---

### 📊 Example

- Weekly Income = ₹5000  
- Working Hours = 50  
- Hourly Income = ₹100  
- Lost Hours = 3  

| Plan     | Payout |
|----------|--------|
| Basic    | ₹240   |
| Standard | ₹300   |
| Premium  | ₹360   |

---

### ⚖️ System Constraints

- Payouts are proportional to **actual income loss**
- Minimum payout avoids negligible compensation  
- A **weekly payout cap (₹1000–₹1500)** ensures sustainability  

---

## 🛡️ Fraud Detection Engine

ZyroSafe uses a **multi-layer, zero-trust fraud detection system**:

### 📍 Location Validation
- GPS vs IP comparison  
- Detect spoofing, VPNs  

### 🌦️ Environmental Verification
- Validate real-world disruption using APIs  

### 📊 Behavioral Analysis
- Detect repeated claims  
- Identify abnormal patterns  

### ⚖️ Risk Scoring

  | Score   | Action   |
  |---------|----------|
  | 0–30    | Approved |
  | 30–70   | Flagged  |
  | 70–100  | Rejected |



## 🚨 Adversarial Defense & Anti-Spoofing Strategy (Market Crash)

### Problem
A coordinated fraud ring using fake GPS can trigger mass payouts and drain system funds.

---

### Defense Strategy

#### 1. Multi-Source Location Validation
- GPS vs IP mismatch detection  
- >50 km deviation → flagged  

---

#### 2. Environmental Consistency Check
- Verify disruption actually occurred in that location  

---

#### 3. Behavioral Clustering
- Detect multiple users from same IP/device patterns  
- Identify synchronized claims  

---

#### 4. Impossible Movement Detection
- Detect unrealistic travel speeds  
- Identify teleportation  

---

#### 5. Fraud Ring Detection
- Cluster users by IP, timing, and behavior  
- Flag entire group  

---

#### 6. Fairness Mechanism
- Only high-risk claims rejected  
- Medium-risk claims reviewed  
- Genuine users unaffected  

---

## 🔁 System Workflow

1. Capture user location  
2. Fetch real-time disruption data  
3. Validate disruption  
4. Apply fraud checks  
5. Assign risk score  
6. Execute payout decision  

**Outcomes:**
- ✅ Approved → Instant payout  
- ⚠️ Flagged → Review  
- ❌ Rejected → Fraud  

---

## 🧠 System Architecture

- Frontend: Web Application  
- Backend: API-based engine  
- Data Sources:
  - Weather APIs  
  - Event/news APIs  

Core modules:
- Disruption Detection Engine  
- Fraud Detection Engine  
- Decision Engine  

---

## ⭐ Key Features

- Real-time disruption detection  
- Automated payouts for delivery partners  
- Fraud-resistant architecture  
- Income-based payout logic  
- Scalable system design  

---

## 🔮 Future Scope

- ML-based anomaly detection  
- Device fingerprinting  
- Large-scale fraud ring detection  
- Dynamic premium pricing  

---

## 📌 Sustainability Model

Premiums are **pooled across all delivery partners**, and payouts are distributed only to affected users. This ensures system sustainability even during high-disruption scenarios.

---

## 📌 Conclusion
ZyroSafe provides a scalable, automated, and fraud-resistant insurance solution tailored for **food delivery partners**.

By combining **real-time data, income-based payouts, and adversarial defense mechanisms**, the platform ensures **fast, fair, and reliable income protection**, even under large-scale attacks.
