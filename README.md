# PriviTrust AI
## Continuous Identity Trust Framework for Privileged Access Security

> **"Trust Every Action, Not Just Every Login."**

PriviTrust AI is a privacy-first Continuous Identity Trust Framework designed to protect financial systems and administrative controls. Instead of trusting a user for the entirety of a session following a single login, PriviTrust AI continuously verifies privileged users (admins, support, auditors) throughout their session, dynamically scores risk, and triggers adaptive authentication challenges or locks sessions instantly on anomalous activity.

---

## Key Features

1. **Relational Audit Logging:** Tracks users, device fingerprints, sessions, raised security threats, and action logs in an ACID-compliant database.
2. **Behavioral Profiling (ML Engine):** Trains an **Isolation Forest** model from `scikit-learn` on 7 days of normal baseline work shift behavior to recognize anomalies in access times, severities, and record volumes.
3. **Adaptive Verification Prompts:**
   - **Low Risk (0-30):** Execute action seamlessly.
   - **Medium Risk (31-60):** Triggers a time-locked (2-min) cached **MFA OTP Challenge**.
   - **High Risk (61-80):** Triggers a **Re-Authentication Password Challenge**.
   - **Critical Risk (81-100):** Locks the session, triggers a security event, and blocks requests.
4. **Simulation Workspace:** Toggles environmental variables (Time of action, Client IP, Unrecognized device) in real-time to witness how the security layers adapt.
5. **Security Admin Dashboard:** Beautiful custom SVG charts tracking network risk trends, online connection logs, interactive log tickers, and CSV export compliance sheets.

---

## Tech Stack
- **Backend:** Python + FastAPI + SQLAlchemy + SQLite (database-agnostic)
- **Caching:** `cachetools` (MFA OTP caching & rate-limiting)
- **Machine Learning:** Scikit-Learn (Isolation Forest anomaly detector)
- **Frontend:** React + TypeScript + Vite + Custom CSS (Banking theme, custom SVG charting)

---

## Local Development Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and activate it:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the API server:
   ```bash
   python main.py
   ```
   *Note: On startup, if the SQLite database is empty, the server automatically executes the `seed_db.py` script. This registers mock credentials, generates a 7-day baseline of 330 logs, and fits the Isolation Forest model.*

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Vite server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`.

---

## Docker Deployment (Compose)

Build and deploy both services locally in a single command using Docker:
```bash
cd docker
docker-compose up --build
```
- **React Client:** accessible at `http://localhost:3000`
- **FastAPI API:** accessible at `http://localhost:8000`

---

## Interactive Demo Walkthrough

### 1. Admin Dashboard View
1. Open the UI, click **Security Admin Preset** on the login page, and sign in.
2. You will be redirected to the **Security Dashboard**. Since there are no active sessions yet, metrics are clean. Notice the SVG charts indicating historical average trend lines.

### 2. Simulate Normal Operation (Low Risk)
1. Open a second private window or log out, click **Alice Support Preset** on the login page.
2. Sign in directly.
3. Trigger **View Support Tickets** or **Verify Customer Identity**. The action goes through successfully (Risk score: `20` - Trusted).

### 3. Simulate Medium Risk (MFA Challenge)
1. In the Alice Workspace, toggle the **Environment Simulator**:
   - Check off **Force Device Trusted Status** (represents a new device fingerprint).
2. Now, click **Query Customer Transactions**.
3. Risk calculation: `new_device (30) + baseline (10) = 40` (Medium).
4. An **OTP Verification Prompt** modal immediately blocks the workspace! A toast display showing the simulated code will slide in (sent to cachetools).
5. Enter the code shown in the green hint container and click Verify. The action succeeds, and the dial reflects the updated risk.

### 4. Simulate High Risk (Re-Authentication)
1. In the simulator, set **Time of Action Override** to a night shift: `23:00` (Off-hours).
2. Keep the device untrusted (unchecked).
3. Now, click **Bulk Account Records Export** (Simulating excessive resource access rate).
4. Risk calculation: `new_device (30) + off-hours (15) + excessive_access (20) = 65` (High).
5. A **Password Re-Authentication Modal** pops up.
6. Enter `AlicePassword123!` to verify. The CSV exports correctly.

### 5. Simulate Critical Risk (Session Block)
1. Keep the device untrusted and off-hours (`23:00`).
2. Now, try to click **Restart Core Services** or **Modify System Permissions** (critical severity, which flags as a behavioral anomaly by Isolation Forest).
3. Risk calculation: `new_device (30) + off-hours (15) + anomaly (25) + excessive (20) = 90` (Critical).
4. The workspace immediately locks up, redirects you, and flags the session status in the DB as **Blocked**.
5. Log in as the **Security Admin**. You will see:
   - Total Active Session counts
   - The active session marked in red with score `90` (Blocked status)
   - A critical entry in the **Live Threat Warnings** ticker: `Session locked during action due to risk score 90.`
   - Access to CSV report sheets showing the audit details.
