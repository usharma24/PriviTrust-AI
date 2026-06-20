from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.database import get_db
from backend.models.models import User, Session as UserSession, SecurityEvent, AuditLog
from backend.routes.deps import get_current_user_and_session

router = APIRouter(prefix="/admin", tags=["monitoring"])

@router.get("/dashboard")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_state = Depends(get_current_user_and_session)
):
    user, _ = current_state
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
        
    # 1. High-level counts
    total_users = db.query(User).filter(User.role != "admin").count()
    
    # Active sessions (not terminated, active in the last 2 hours)
    two_hours_ago = datetime.utcnow() - timedelta(hours=2)
    active_sessions_count = db.query(UserSession).filter(
        UserSession.status.in_(["Active", "MFA_Pending", "Blocked"]),
        UserSession.login_time >= two_hours_ago
    ).count()
    
    # High risk sessions (risk score > 60)
    high_risk_sessions = db.query(UserSession).filter(
        UserSession.status.in_(["Active", "MFA_Pending", "Blocked"]),
        UserSession.risk_score > 60.0
    ).count()
    
    # Critical alerts count
    critical_alerts = db.query(SecurityEvent).filter(
        SecurityEvent.severity == "Critical"
    ).count()
    
    # 2. Live Active Sessions list
    sessions = db.query(UserSession).filter(
        UserSession.status.in_(["Active", "MFA_Pending", "Blocked"])
    ).order_by(UserSession.login_time.desc()).all()
    
    session_list = []
    for s in sessions:
        u = db.query(User).filter(User.id == s.user_id).first()
        if u:
            session_list.append({
                "id": s.id,
                "user_id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "risk_score": s.risk_score,
                "status": s.status,
                "login_time": s.login_time.isoformat()
            })
            
    # 3. Live Security Events ticker (last 30 events)
    events = db.query(SecurityEvent).order_by(SecurityEvent.created_at.desc()).limit(30).all()
    event_list = []
    for e in events:
        u = db.query(User).filter(User.id == e.user_id).first()
        event_list.append({
            "id": e.id,
            "user_name": u.name if u else "Unknown User",
            "email": u.email if u else "",
            "event_type": e.event_type,
            "severity": e.severity,
            "description": e.description,
            "created_at": e.created_at.isoformat()
        })
        
    # 4. SVG Chart Data (Aggregated risk counts)
    risk_distribution = {
        "Low": db.query(UserSession).filter(UserSession.risk_score <= 30.0, UserSession.status != "Terminated").count(),
        "Medium": db.query(UserSession).filter(UserSession.risk_score > 30.0, UserSession.risk_score <= 60.0, UserSession.status != "Terminated").count(),
        "High": db.query(UserSession).filter(UserSession.risk_score > 60.0, UserSession.risk_score <= 80.0, UserSession.status != "Terminated").count(),
        "Critical": db.query(UserSession).filter(UserSession.risk_score > 80.0, UserSession.status != "Terminated").count()
    }
    
    # 5. Risk score trend over hours (mock/aggregated based on audit logs)
    # We aggregate average risk score by hour for the last 12 hours
    trend_list = []
    now = datetime.utcnow()
    for i in range(11, -1, -1):
        hour_start = now - timedelta(hours=i+1)
        hour_end = now - timedelta(hours=i)
        
        # Calculate avg risk score in this hour
        avg_risk = db.query(func.avg(AuditLog.risk_score)).filter(
            AuditLog.timestamp >= hour_start,
            AuditLog.timestamp < hour_end
        ).scalar() or 0.0
        
        label = hour_end.strftime("%H:%M")
        trend_list.append({
            "hour": label,
            "avg_risk": round(float(avg_risk), 1)
        })
        
    return {
        "metrics": {
            "total_users": total_users,
            "active_sessions": active_sessions_count,
            "high_risk_users": high_risk_sessions,
            "critical_alerts": critical_alerts
        },
        "active_sessions": session_list,
        "security_events": event_list,
        "risk_distribution": risk_distribution,
        "risk_trend": trend_list
    }

@router.post("/sessions/terminate/{session_id}")
def terminate_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_state = Depends(get_current_user_and_session)
):
    user, _ = current_state
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
        
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session.status = "Terminated"
    db.add(AuditLog(
        user_id=session.user_id,
        event_type="Session Terminated",
        event_description="Session administratively terminated by Security Admin.",
        risk_score=0.0
    ))
    db.commit()
    return {"message": "Session terminated successfully"}
