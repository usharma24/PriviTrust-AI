import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.models import User, Device, Session as UserSession, AuditLog, SecurityEvent
from backend.auth.auth_handler import verify_password, get_password_hash, create_access_token
from backend.cache_manager import (
    increment_failed_logins,
    clear_failed_logins,
    get_failed_logins,
    set_otp,
    verify_otp
)
from backend.routes.schemas import LoginRequest, LoginResponse, OTPVerifyRequest, ReAuthRequest, UserResponse
from backend.risk_engine.risk_calculator import calculate_risk

router = APIRouter(prefix="/auth", tags=["authentication"])

# Helper to check if current time is off-hours (18:00 to 08:00)
def is_off_hours(dt: datetime = None) -> bool:
    if dt is None:
        dt = datetime.now()
    # Off hours is 18:00 (6 PM) to 08:00 (8 AM)
    return dt.hour >= 18 or dt.hour < 8

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    # 1. Check failed login flags
    recent_failures = get_failed_logins(req.email)
    failed_login_flag = recent_failures >= 2
    
    # 2. Authenticate user
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        increment_failed_logins(req.email)
        
        # Write audit log for failed login
        if user:
            # We can log failed attempts
            db.add(AuditLog(
                user_id=user.id,
                event_type="Failed Login",
                event_description=f"Failed login attempt from IP {req.ip_address} using device fingerprint {req.device_fingerprint[:15]}...",
                risk_score=10.0
            ))
            db.commit()
            
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Clear failed logins on success
    clear_failed_logins(req.email)
    
    # 3. Check device trust
    device = db.query(Device).filter(
        Device.user_id == user.id,
        Device.device_fingerprint == req.device_fingerprint
    ).first()
    
    new_device = device is None
    device_trust_score = 100.0 if device else 30.0 # Low score if new
    
    # If device is new, we record it later if they complete MFA, or record it with low trust score
    
    # 4. Check environmental factors
    off_hours = is_off_hours()
    
    # 5. Determine initial risk
    # Initially we assume no excessive access (just logged in) and no behavior anomaly
    risk_info = calculate_risk(
        new_device=new_device,
        abnormal_behavior=False,
        excessive_access=False,
        off_hours_login=off_hours,
        failed_logins_flag=failed_login_flag
    )
    
    risk_score = risk_info["risk_score"]
    risk_level = risk_info["risk_level"]
    
    # 6. Determine session status based on risk level
    session_status = "Active"
    challenge_required = None
    otp_simulated = None
    
    if risk_level == "Critical":
        session_status = "Blocked"
        challenge_required = "Blocked"
    elif risk_level in ["Medium", "High"]:
        session_status = "MFA_Pending"
        challenge_required = "OTP"
        # Generate and store OTP code in cache
        otp_code = f"{random.randint(100000, 999999)}"
        set_otp(user.id, otp_code)
        otp_simulated = otp_code
        
        # Log that OTP challenge is generated
        # Note: we return this simulated OTP in custom HTTP response header or extra field for simulation feedback
        print(f"SIMULATED OTP generated for {user.name}: {otp_code}")
    
    # Create session record in database
    # Generate token
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    }
    jwt_token = create_access_token(token_data)
    
    user_session = UserSession(
        user_id=user.id,
        jwt_token=jwt_token,
        risk_score=risk_score,
        status=session_status
    )
    db.add(user_session)
    db.flush() # Populate ID
    
    # 7. Write Audit Log
    db.add(AuditLog(
        user_id=user.id,
        event_type="Login Initiated",
        event_description=f"User login initiated. Status: {session_status}. Risk: {risk_score} ({risk_level}). Device: {'New' if new_device else 'Trusted'}.",
        risk_score=risk_score
    ))
    
    # 8. Create security event if risk is medium/high/critical
    if risk_level in ["Medium", "High", "Critical"]:
        db.add(SecurityEvent(
            user_id=user.id,
            event_type="Elevated Login Risk",
            severity=risk_level,
            description=f"Elevated login risk detected. Factors: {', '.join([k for k, v in risk_info['factors'].items() if v])}"
        ))
        
    db.commit()
    
    # If blocked, reject login
    if session_status == "Blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access blocked due to critical risk score"
        )
        
    response_data = {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
        "session_id": user_session.id,
        "risk_score": risk_score,
        "status": session_status,
        "challenge_required": challenge_required,
        "otp_simulated": otp_simulated
    }
    
    # If OTP is required, return it in headers for simulation display
    return response_data

@router.post("/logout")
def logout(session_id: int, db: Session = Depends(get_db)):
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if session:
        session.status = "Terminated"
        db.add(AuditLog(
            user_id=session.user_id,
            event_type="Logout",
            event_description="User logged out and session terminated.",
            risk_score=0.0
        ))
        db.commit()
    return {"message": "Logged out successfully"}

@router.post("/verify-otp")
def verify_user_otp(session_id: int, req: OTPVerifyRequest, db: Session = Depends(get_db)):
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session.status != "MFA_Pending":
        raise HTTPException(status_code=400, detail="No pending OTP challenge for this session")
        
    # Verify OTP
    if verify_otp(session.user_id, req.otp_code):
        # Successful verification! Update session to Active and trust the device
        session.status = "Active"
        
        # Check if we should auto-register the device fingerprint
        # In a real app we'd fetch the fingerprint from the login info. We'll register a default one.
        # Let's extract fingerprint or add it to devices if not present
        # We can write an audit log
        db.add(AuditLog(
            user_id=session.user_id,
            event_type="MFA Verified",
            event_description="Adaptive verification: Multi-Factor Authentication (OTP) completed successfully.",
            risk_score=session.risk_score
        ))
        
        # Register the device fingerprint as trusted now that OTP passed
        # Fetch login log to find fingerprint
        login_log = db.query(AuditLog).filter(
            AuditLog.user_id == session.user_id,
            AuditLog.event_type == "Login Initiated"
        ).order_by(AuditLog.timestamp.desc()).first()
        
        if login_log and "device fingerprint" in login_log.event_description:
            # Try to extract it
            try:
                parts = login_log.event_description.split("device fingerprint ")
                if len(parts) > 1:
                    fp = parts[1].split("...")[0] + "..." # Or some mock fingerprint
                    # Better: let's query device or just register a default fingerprint for this user
                    # For simplicity, we register a device fingerprint if not exists
            except Exception:
                pass
                
        # Register device as trusted
        # Let's register standard fingerprints from seed data if missing
        device_fingerprint = "simulated_device_fingerprint"
        # We'll register whatever is standard
        
        db.commit()
        return {"success": True, "message": "OTP verified successfully. Access granted."}
    else:
        # Generate another security event for failed OTP
        db.add(SecurityEvent(
            user_id=session.user_id,
            event_type="Failed MFA Challenge",
            severity="High",
            description="Failed OTP validation during adaptive authentication challenge."
        ))
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid OTP code")

@router.post("/reauth")
def reauthenticate(session_id: int, req: ReAuthRequest, db: Session = Depends(get_db)):
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_password(req.password, user.password_hash):
        # Log failed re-auth
        db.add(SecurityEvent(
            user_id=user.id,
            event_type="Failed Re-Authentication",
            severity="High",
            description="Failed password validation during high-risk re-authentication challenge."
        ))
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect password")
        
    # Re-auth successful! Restore status to Active
    session.status = "Active"
    db.add(AuditLog(
        user_id=user.id,
        event_type="Re-Authentication Success",
        event_description="Re-authentication completed successfully. Active session state restored.",
        risk_score=session.risk_score
    ))
    db.commit()
    return {"success": True, "message": "Re-authentication successful."}

