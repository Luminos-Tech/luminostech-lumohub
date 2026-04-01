from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import UserResponse, UserUpdateRequest, PasswordChangeRequest
from app.crud.user import update_user, change_password
from app.core.security import verify_password
from app.services.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(body: UserUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    updated = update_user(db, current_user,
                          full_name=body.full_name,
                          phone=body.phone,
                          avatar_url=body.avatar_url)
    return updated


@router.patch("/me/password", status_code=204)
def change_my_password(body: PasswordChangeRequest, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_active_user)):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    change_password(db, current_user, body.new_password)
