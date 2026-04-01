from pydantic import BaseModel, EmailStr


class AdminCreateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "user"


class AdminResetPasswordRequest(BaseModel):
    new_password: str
