from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.models import User, Session as UserSession
from backend.auth.auth_handler import decode_access_token

security = HTTPBearer()

def get_current_user_and_session(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Extracts JWT token, validates user, checks active session status in the DB.
    Raises 401 for invalid tokens, and 403 for blocked/terminated sessions.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing sub",
        )
        
    user_id = int(user_id_str)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
        
    # Check if there is an active session matching this token
    user_session = db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.jwt_token == token
    ).order_by(UserSession.login_time.desc()).first()
    
    if not user_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Active session not found. Please log in again.",
        )
        
    if user_session.status == "Terminated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been logged out/terminated.",
        )
        
    if user_session.status == "Blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access blocked. Your session has been locked due to suspicious activity. Please contact your Security Administrator.",
        )
        
    return user, user_session
