import os
import pickle
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA # available in sklearn
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "behavior_model.pkl")

# Helper to map event type to severity
def get_severity_by_event(event_type: str) -> int:
    event_type = event_type.lower()
    if "escalate" in event_type or "modify permissions" in event_type or "restart" in event_type:
        return 3 # Critical
    elif "report" in event_type or "export" in event_type or "download" in event_type:
        return 2 # High
    elif "verify" in event_type or "search" in event_type or "transaction" in event_type:
        return 1 # Medium
    return 0 # Low

def extract_features_from_logs(logs, db_session: Session):
    """
    Extracts features for ML model training:
    - hour_of_day (0-23)
    - is_weekend (0 or 1)
    - resource_count (1 or parsed from desc)
    - action_severity (0-3)
    - device_trust_score (default 100.0 or looked up)
    """
    from backend.models.models import Device

    data = []
    for log in logs:
        dt = log.timestamp
        hour_of_day = dt.hour + dt.minute / 60.0
        is_weekend = 1 if dt.weekday() >= 5 else 0
        
        # Parse resource count (look for number IDs)
        # e.g., "ID 1234" -> 1. If multiple IDs are separated by commas, we can count them
        desc = log.event_description
        # Basic heuristic: if "bulk" in description or multiple IDs, we count them.
        # Otherwise default to 1.
        resource_count = 1
        if "bulk" in desc.lower():
            resource_count = 15 # Simulated bulk access
        
        action_severity = get_severity_by_event(log.event_type)
        
        # Lookup device trust score
        # For historical baseline, it's 100
        device_trust_score = 100.0
        
        data.append([hour_of_day, is_weekend, resource_count, action_severity, device_trust_score])
    
    return pd.DataFrame(data, columns=["hour_of_day", "is_weekend", "resource_count", "action_severity", "device_trust_score"])

def train_model(db_session: Session):
    """
    Loads baseline logs from db, trains IsolationForest, and saves to file.
    """
    from backend.models.models import AuditLog, User
    
    print("Fetching baseline logs from database for model training...")
    # Fetch all audit logs for privileged users
    logs = db_session.query(AuditLog).join(User).filter(User.role == "privileged_user").all()
    
    if len(logs) < 50:
        print(f"Not enough logs to train model (found {len(logs)}). Need at least 50.")
        return False
        
    df = extract_features_from_logs(logs, db_session)
    
    # Train Isolation Forest
    # contamination = 0.05 (expect 5% normal variance anomalies in baseline)
    model = IsolationForest(
        n_estimators=100,
        max_samples="auto",
        contamination=0.05,
        random_state=42
    )
    
    X = df.values
    model.fit(X)
    
    # Save the model using pickle (simpler than joblib and doesn't require extra dependency)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
        
    print(f"Isolation Forest model trained successfully on {len(X)} samples and saved to {MODEL_PATH}")
    return True

def predict_anomaly(hour_of_day: float, is_weekend: int, resource_count: int, action_severity: int, device_trust_score: float) -> bool:
    """
    Predicts if the action is anomalous.
    Returns: True if anomalous, False if normal.
    """
    if not os.path.exists(MODEL_PATH):
        # Model not trained yet, return normal by default
        return False
        
    try:
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
            
        x = np.array([[hour_of_day, is_weekend, resource_count, action_severity, device_trust_score]])
        prediction = model.predict(x)
        
        # -1 indicates anomaly, 1 indicates normal
        return prediction[0] == -1
    except Exception as e:
        print(f"Anomaly prediction error: {e}")
        return False
