from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_fingerprint: str
    browser_info: str
    os_info: str
    ip_address: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    
    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    session_id: int
    risk_score: float
    status: str # 'Active', 'Blocked', 'MFA_Pending'
    challenge_required: Optional[str] = None # None, 'OTP'
    otp_simulated: Optional[str] = None

class OTPVerifyRequest(BaseModel):
    otp_code: str

class ReAuthRequest(BaseModel):
    password: str

class ActionPerformRequest(BaseModel):
    action_type: str
    resource_id: Optional[str] = None
    resource_count: int = 1
    # Environmental simulation overrides:
    simulated_time: Optional[str] = None # e.g. "2026-06-20T22:30:00"
    simulated_ip: Optional[str] = None
    simulated_fingerprint: Optional[str] = None
    simulated_device_trusted: Optional[bool] = None

class ActionPerformResponse(BaseModel):
    success: bool
    status: str # 'Allowed', 'OTP_Required', 'ReAuth_Required', 'Blocked'
    risk_score: float
    risk_level: str
    factors: Dict[str, bool]
    otp_simulated: Optional[str] = None # Return generated OTP in response for simulation toast
    message: str
