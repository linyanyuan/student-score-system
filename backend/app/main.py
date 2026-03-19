from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import re

from app.database import engine, Base
from app.config import CORS_ORIGINS
from app.routers import auth
from app.routers import classes, subjects, teacher_classes, custom_fields, students
from app.routers import exams, scores, analysis
from app.routers import schedule_periods, teacher_schedules, memos, daily_quote

Base.metadata.create_all(bind=engine)

app = FastAPI(title="学生成绩管理系统", version="1.0.0")

# 使用正则表达式匹配 Vercel 域名
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(subjects.router)
app.include_router(teacher_classes.router)
app.include_router(custom_fields.router)
app.include_router(students.router)
app.include_router(exams.router)
app.include_router(scores.router)
app.include_router(analysis.router)
app.include_router(schedule_periods.router)
app.include_router(teacher_schedules.router)
app.include_router(memos.router)
app.include_router(daily_quote.router)
