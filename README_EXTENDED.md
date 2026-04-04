ZyroSafe – AI-Powered Parametric Insurance for Food Delivery Partners

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

---

# Extended Product Documentation

This section expands the README into a product and operational reference that can be used as the basis for terms, policy, disclosures, support documentation, and internal operational notes.

## 1. Product Purpose
ZyroSafe is designed to reduce income volatility for delivery partners by paying when clearly defined external conditions occur. It is a rules-based automation platform, not a manual claims service.

### What the product does
- Detects qualifying disruption conditions
- Validates the disruption against live weather and event data
- Scores potential fraud risk
- Approves, flags, or rejects the claim flow
- Records transaction history for auditing and review

### What the product does not do
- It does not replace all traditional insurance products
- It does not guarantee payment in every adverse condition
- It does not pay for damage to vehicles, devices, or property unless explicitly configured in future product rules
- It does not perform manual human underwriting in the trigger flow

## 2. User Journey
The typical user flow is:
1. Sign up or log in
2. Complete onboarding details
3. Allow live location access
4. View weather, location, and risk status
5. Trigger a simulation or live claim event
6. Receive an automatic decision
7. View transaction history and rejected items

## 3. User Interface Pages
The application currently contains these primary views:

### Operations
- Main simulation and payout page
- Shows disruption controls, live weather, risk scoring, and payout state
- Used for triggering and observing the claim workflow

### Transactions
- Shows the full transaction history
- Includes approved, flagged, and rejected entries
- Used for audit and review

### User Info
- Shows the user's profile and identity details
- Displays name, email, phone, plan, delivery mode, city, state, weekly income, and working hours
- Also shows the live location snapshot

## 4. Data Captured by the Product
Depending on user actions and permissions, the application may process:

### Account and profile data
- Name
- Email
- Phone number
- City and state
- Delivery areas
- Delivery mode
- App platforms used
- Income and working hours
- Insurance plan

### Operational data
- GPS location coordinates
- GPS accuracy
- Live weather data
- Forecast probability data
- Triggered disruption selection
- Fraud score and flags
- Transaction status and payout value

### Technical data
- IP address
- Approximate IP geolocation
- Browser session state
- Transaction ids and timestamps
- Audit logs

## 5. Location Processing
The app uses live GPS and reverse geocoding to display a more precise location.

### Location display hierarchy
- Best effort locality or suburb from reverse geocoding
- City and state when locality is unavailable
- Raw GPS coordinates with accuracy

### Why both are shown
- The locality helps the user understand where the system thinks they are
- GPS coordinates provide operational traceability
- Accuracy values help users judge location precision

## 6. Fraud Logic Summary
The fraud engine is rule-based and interprets the following:
- GPS/IP distance mismatch
- Anonymous or suspicious IP behavior
- Rapid unrealistic movement
- Missing GPS data
- Repeated or inconsistent claim behavior

### Decision states
- Approved
- Flagged
- Rejected

These states are visible to the user and stored in transaction history.

## 7. Transaction Storage and History
The app keeps transaction records so the user can review activity later.

### Stored transaction fields
- Transaction id
- Email
- User id when available
- Timestamp
- Type
- Status
- Amount
- Description
- Metadata

### History behavior
- The dashboard updates immediately when a trigger is created
- The transaction list refreshes automatically while the app is open
- History is intended to persist across sessions and browsers through server-side storage

## 8. Persistence Model
The system tries to store important records in permanent backends first.

### Preferred storage order
1. MongoDB
2. MongoDB-backed persistence only
3. Temporary in-memory fallback only when no permanent storage is reachable

### Why this matters
- In-memory storage disappears on restart
- Permanent storage is necessary for cross-session and cross-browser history
- This is especially important for rejected transactions and audit records

## 9. Realtime Update Behavior
The dashboard is designed to reduce the need for refresh.

### Same browser
- The count and transaction list update immediately after a trigger
- This is done through optimistic UI updates

### Other browser or session
- The dashboard polls the server periodically
- It also refreshes on focus
- If the other browser does not update instantly, it should update after the next poll or refresh

## 10. Risk Score Interpretation
The fraud risk score is operational rather than actuarial.

### Meaning of the score
- Low score: lower risk, likely approval
- Medium score: review or warning
- High score: rejection

### Important note
The score is only one part of the decision. Weather mismatch and other hard rules can reject a claim even before a deeper score-based workflow completes.

## 11. Weather and Trigger Rules
The platform uses threshold-based triggers rather than subjective claim decisions.

### Example rules
- Moderate rain: 45–60 mm/day
- Severe rain: >60 mm/day
- Extreme heat: >45°C
- Cyclone or storm alerts: qualifying severe event

### Trigger validation
A trigger is only treated as valid when live data supports the selected disruption type.

## 12. Payout Logic
Payouts are derived from user earnings and disruption severity.

### Inputs
- Weekly income
- Weekly working hours
- Selected insurance plan
- Loss hours estimated from disruption severity

### Derived values
- Hourly income
- Minimum payout
- Cap on weekly payout
- Final computed payout

## 13. Audit and Review Use
This product stores enough information for later review of:
- Why a claim was approved
- Why a claim was flagged
- Why a claim was rejected
- What location data was used
- What weather data was used
- What transaction was created

This is important for support, dispute handling, and policy review.

## 14. Security and Privacy Notes
For policy drafting, these are the main subjects that may need disclosure:
- Location access permission
- Weather and IP lookup usage
- Account identity linking
- Transaction and risk log storage
- Fraud detection processing
- Retention of audit history

## 15. Suggested Policy Topics
You can use the information above to draft or update:
- Terms of Service
- Privacy Policy
- Location Data Policy
- Cookie and Session Policy
- Refund or payout policy
- Fraud prevention disclosure
- Data retention policy
- Support and dispute resolution policy

## 16. Known Limitations
- Weather and reverse geocoding depend on third-party services
- Location accuracy depends on the browser/device
- Network failures can delay updates
- Permanent storage depends on backend connectivity and configuration
- Some fallback behavior may still appear while services are unavailable

## 17. Operational Notes
- The application is intended for demonstration and controlled deployment unless further hardened
- Claims can be simulated for testing the workflow
- Rejected history should be reviewed carefully before relying on it in production
- Background polling is used to keep multiple sessions reasonably in sync

## 18. Recommended Legal Drafting Inputs
If you want to create formal documents later, use these fields as input sections:
- Product description
- User eligibility
- Required permissions
- Data categories collected
- Processing purposes
- Payout conditions
- Fraud and abuse policy
- Storage and retention rules
- Third-party service disclosures
- Support and escalation path
- Limitation of liability
- Service availability and downtime

## 19. Internal Design Summary
ZyroSafe is built around a simple decision chain:
- Identify user and operating context
- Resolve live location and weather
- Compare the active trigger to the live condition
- Compute risk and fraud score
- Store the result
- Display the result immediately in the UI

## 20. Final Note
This document is intended as a comprehensive product reference. It is not legal advice and should be reviewed by a qualified professional before being used as terms, privacy policy, or compliance documentation.
