import os
import secrets


SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
DATABASE_URL = "sqlite:///./student_score.db"

# CORS 配置
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,https://project-84h33.vercel.app").split(",")
