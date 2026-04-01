from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.schemas.user import UserResponse
from app.crud.user import get_user_by_email, create_user, authenticate_user
from app.crud.session import create_session, get_session_by_token, delete_session
from app.crud.log import log_action
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = create_user(db, full_name=body.full_name, email=body.email, password=body.password)
    log_action(db, action="register", user_id=user.id, target_type="user", target_id=user.id,
               ip_address=request.client.host if request.client else None)
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    create_session(db, user_id=user.id, token=refresh_token)
    log_action(db, action="login", user_id=user.id, ip_address=request.client.host if request.client else None)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    session = get_session_by_token(db, body.refresh_token)
    if not session:
        raise HTTPException(status_code=401, detail="Refresh token not found or expired")
    user_id = payload.get("sub")
    delete_session(db, session)
    new_access = create_access_token({"sub": str(user_id)})
    new_refresh = create_refresh_token({"sub": str(user_id)})
    create_session(db, user_id=int(user_id), token=new_refresh)
    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    session = get_session_by_token(db, body.refresh_token)
    if session:
        delete_session(db, session)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_active_user)):
    return current_user
