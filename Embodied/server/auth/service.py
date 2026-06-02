"""认证业务逻辑：密码哈希、JWT 签发/验证、注册/登录。"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth.models import User
from server.auth.schemas import LoginRequest, TokenPayload, UserCreate
from server.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: int, token_type: str) -> str:
    settings = get_settings()
    if token_type == "access":
        expires = timedelta(minutes=settings.access_token_expire_minutes)
    else:
        expires = timedelta(days=settings.refresh_token_expire_days)

    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + expires,
        "type": token_type,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_access_token(user_id: int) -> str:
    return _create_token(user_id, "access")


def create_refresh_token(user_id: int) -> str:
    return _create_token(user_id, "refresh")


def decode_token(token: str) -> TokenPayload:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return TokenPayload(**payload)
    except JWTError as e:
        raise ValueError(f"无效的 token: {e}") from e


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none() is not None:
        raise ValueError("用户名已存在")

    user = User(username=data.username, password_hash=hash_password(data.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user
