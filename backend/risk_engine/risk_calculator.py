from typing import Dict, Any

def calculate_risk(
    new_device: bool,
    abnormal_behavior: bool,
    excessive_access: bool,
    off_hours_login: bool,
    failed_logins_flag: bool
) -> Dict[str, Any]:
    """
    Calculates the session risk score based on the formal equation:
    Risk = (new_device * 30) + (abnormal_behavior * 25) + (excessive_access * 20) + (off_hours_login * 15) + (failed_logins * 10)
    
    Returns a dictionary with the score, risk level, and contributing factors.
    """
    # Cast booleans to 1 or 0
    d_val = 30 if new_device else 0
    a_val = 25 if abnormal_behavior else 0
    e_val = 20 if excessive_access else 0
    o_val = 15 if off_hours_login else 0
    f_val = 10 if failed_logins_flag else 0
    
    risk_score = d_val + a_val + e_val + o_val + f_val
    
    # Map to risk level bands
    if risk_score <= 30:
        level = "Low"
    elif risk_score <= 60:
        level = "Medium"
    elif risk_score <= 80:
        level = "High"
    else:
        level = "Critical"
        
    return {
        "risk_score": float(risk_score),
        "risk_level": level,
        "factors": {
            "new_device": new_device,
            "abnormal_behavior": abnormal_behavior,
            "excessive_access": excessive_access,
            "off_hours_login": off_hours_login,
            "failed_logins": failed_logins_flag
        }
    }
