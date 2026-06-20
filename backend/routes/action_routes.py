import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.models import AuditLog, SecurityEvent
from backend.routes.deps import get_current_user_and_session
from backend.routes.schemas import ActionPerformRequest, ActionPerformResponse
from backend.risk_engine.risk_calculator import calculate_risk
from backend.cache_manager import set_otp, get_failed_logins
from ml.isolation_forest import predict_anomaly, get_severity_by_event

router = APIRouter(prefix="/actions", tags=["actions"])

# Helper to check if a specific datetime is off-hours (18:00 to 08:00)
def is_off_hours(dt: datetime) -> bool:
    return dt.hour >= 18 or dt.hour < 8

@router.post("/perform", response_model=ActionPerformResponse)
def perform_action(
    req: ActionPerformRequest,
    db: Session = Depends(get_db),
    current_state = Depends(get_current_user_and_session)
):
    user, session = current_state
    
    # 1. Parse environmental simulation factors
    action_time = datetime.now()
    if req.simulated_time:
        try:
            # Expect format YYYY-MM-DDTHH:MM:SS
            action_time = datetime.fromisoformat(req.simulated_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid simulated_time format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")
            
    client_ip = req.simulated_ip or "192.168.1.50" # Default office IP
    
    # 2. Check Device Trust
    # If simulated_device_trusted is explicitly set, we respect it.
    # Otherwise, check if fingerprint matches a device in DB.
    fingerprint = req.simulated_fingerprint or "alice_macbook_chrome_fingerprint"
    
    new_device = True
    if req.simulated_device_trusted is not None:
        new_device = not req.simulated_device_trusted
    else:
        # Check database
        from backend.models.models import Device
        device_in_db = db.query(Device).filter(
            Device.user_id == user.id,
            Device.device_fingerprint == fingerprint
        ).first()
        if device_in_db:
            new_device = False
            
    # 3. Check Off-Hours Activity
    off_hours = is_off_hours(action_time)
    
    # 4. Check Failed Logins
    recent_failures = get_failed_logins(user.email)
    failed_logins_flag = recent_failures >= 1
    
    # 5. Check Excessive Access rate-limiting
    # Condition A: action requests bulk resource_count > 10 (e.g. exporting customer list)
    # Condition B: user has completed more than 5 actions in the last 1 minute in audit_logs
    excessive_access = False
    if req.resource_count > 10:
        excessive_access = True
    else:
        one_minute_ago = action_time - timedelta(minutes=1)
        recent_action_count = db.query(AuditLog).filter(
            AuditLog.user_id == user.id,
            AuditLog.timestamp >= one_minute_ago,
            AuditLog.event_type.not_in(["Login Initiated", "Logout", "MFA Verified"])
        ).count()
        if recent_action_count >= 5:
            excessive_access = True

    # 6. Check Behavior Anomaly using Isolation Forest
    # Map event type to severity
    severity_level = get_severity_by_event(req.action_type)
    is_weekend = 1 if action_time.weekday() >= 5 else 0
    hour_of_day = action_time.hour + action_time.minute / 60.0
    device_trust = 100.0 if not new_device else 30.0
    
    abnormal_behavior = predict_anomaly(
        hour_of_day=hour_of_day,
        is_weekend=is_weekend,
        resource_count=req.resource_count,
        action_severity=severity_level,
        device_trust_score=device_trust
    )
    
    # If the action is a critical attempt like privilege escalation, force abnormal_behavior to true for demo purposes
    if severity_level == 3:
        abnormal_behavior = True

    # 7. Calculate Risk Score
    risk_info = calculate_risk(
        new_device=new_device,
        abnormal_behavior=abnormal_behavior,
        excessive_access=excessive_access,
        off_hours_login=off_hours,
        failed_logins_flag=failed_logins_flag
    )
    
    risk_score = risk_info["risk_score"]
    risk_level = risk_info["risk_level"]
    factors = risk_info["factors"]
    
    # 8. Handle Adaptive Security Actions
    status_response = "Allowed"
    otp_simulated = None
    message = "Action executed successfully."
    
    # Update current session risk score
    session.risk_score = risk_score
    
    if risk_level == "Critical":
        # Block session
        session.status = "Blocked"
        status_response = "Blocked"
        message = "Access blocked. Your session has been locked due to critical risk factors."
        
        # Log critical security event
        db.add(SecurityEvent(
            user_id=user.id,
            event_type="Session Blocked",
            severity="Critical",
            description=f"Session locked during action '{req.action_type}' due to risk score {risk_score}."
        ))
        
        # Log audit entry
        db.add(AuditLog(
            user_id=user.id,
            event_type="Session Blocked",
            event_description=f"Action '{req.action_type}' BLOCKED. Session status changed to Blocked.",
            risk_score=risk_score,
            timestamp=action_time
        ))
        
    elif risk_level == "High":
        # Re-Authentication required (Password verification)
        session.status = "MFA_Pending" # Puts session in validation lock
        status_response = "ReAuth_Required"
        message = "Re-authentication required. Please enter your password to confirm identity."
        
        db.add(SecurityEvent(
            user_id=user.id,
            event_type="Re-Authentication Challenged",
            severity="High",
            description=f"High risk score {risk_score} triggered password challenge for action '{req.action_type}'."
        ))
        
        db.add(AuditLog(
            user_id=user.id,
            event_type="Re-Auth Challenged",
            event_description=f"Re-authentication challenge triggered for action '{req.action_type}'.",
            risk_score=risk_score,
            timestamp=action_time
        ))
        
    elif risk_level == "Medium":
        # OTP required
        session.status = "MFA_Pending" # Puts session in validation lock
        status_response = "OTP_Required"
        message = "Adaptive verification required. Enter the 6-digit OTP code to continue."
        
        # Generate random OTP and cache it
        otp_code = f"{random.randint(100000, 999999)}"
        set_otp(user.id, otp_code)
        otp_simulated = otp_code
        
        db.add(SecurityEvent(
            user_id=user.id,
            event_type="MFA Challenged",
            severity="Medium",
            description=f"Medium risk score {risk_score} triggered OTP challenge for action '{req.action_type}'."
        ))
        
        db.add(AuditLog(
            user_id=user.id,
            event_type="MFA Challenged",
            event_description=f"OTP verification challenge triggered for action '{req.action_type}'.",
            risk_score=risk_score,
            timestamp=action_time
        ))
        
    else: # Low Risk
        # Action is allowed to execute!
        db.add(AuditLog(
            user_id=user.id,
            event_type=req.action_type,
            event_description=f"Action '{req.action_type}' executed successfully. Resource Count: {req.resource_count}.",
            risk_score=risk_score,
            timestamp=action_time
        ))
        
    db.commit()
    
    return {
        "success": risk_level == "Low",
        "status": status_response,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "factors": factors,
        "otp_simulated": otp_simulated,
        "message": message
    }
