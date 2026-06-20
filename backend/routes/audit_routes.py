from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from backend.database import get_db
from backend.models.models import AuditLog, User, SecurityEvent
from backend.routes.deps import get_current_user_and_session

router = APIRouter(prefix="/admin", tags=["audit"])

@router.get("/audit-logs")
def get_audit_logs(
    user_id: Optional[int] = None,
    event_type: Optional[str] = None,
    min_risk: Optional[float] = None,
    db: Session = Depends(get_db),
    current_state = Depends(get_current_user_and_session)
):
    user, _ = current_state
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
        
    query = db.query(AuditLog, User).join(User, AuditLog.user_id == User.id)
    
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if event_type:
        query = query.filter(AuditLog.event_type.like(f"%{event_type}%"))
    if min_risk is not None:
        query = query.filter(AuditLog.risk_score >= min_risk)
        
    # Order by newest first
    results = query.order_by(desc(AuditLog.timestamp)).all()
    
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_name": u.name,
            "user_email": u.email,
            "event_type": log.event_type,
            "event_description": log.event_description,
            "risk_score": log.risk_score,
            "timestamp": log.timestamp.isoformat()
        }
        for log, u in results
    ]

@router.get("/security-events")
def get_security_events(
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    current_state = Depends(get_current_user_and_session)
):
    user, _ = current_state
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")
        
    query = db.query(SecurityEvent, User).join(User, SecurityEvent.user_id == User.id)
    
    if severity:
        query = query.filter(SecurityEvent.severity == severity)
        
    results = query.order_by(desc(SecurityEvent.created_at)).all()
    
    return [
        {
            "id": event.id,
            "user_id": event.user_id,
            "user_name": u.name,
            "user_email": u.email,
            "event_type": event.event_type,
            "severity": event.severity,
            "description": event.description,
            "created_at": event.created_at.isoformat()
        }
        for event, u in results
    ]
