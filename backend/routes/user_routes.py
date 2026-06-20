from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models.models import Device
from backend.routes.deps import get_current_user_and_session
from backend.routes.schemas import UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserResponse)
def get_me(current_state = Depends(get_current_user_and_session)):
    user, _ = current_state
    return user

@router.get("/devices")
def get_my_devices(
    current_state = Depends(get_current_user_and_session),
    db: Session = Depends(get_db)
):
    user, _ = current_state
    devices = db.query(Device).filter(Device.user_id == user.id).all()
    return [
        {
            "id": d.id,
            "device_fingerprint": d.device_fingerprint,
            "device_trust_score": d.device_trust_score,
            "last_used": d.last_used.isoformat()
        }
        for d in devices
    ]
