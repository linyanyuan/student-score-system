"""管理员账号创建脚本

使用方法：
    cd backend
    python create_admin.py <用户名> <密码>

示例：
    python create_admin.py admin admin123
"""
import sys

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.utils.security import hash_password

Base.metadata.create_all(bind=engine)


def create_admin(username: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"错误：用户名 '{username}' 已存在")
            sys.exit(1)

        user = User(
            username=username,
            password_hash=hash_password(password),
            role="admin",
        )
        db.add(user)
        db.commit()
        print(f"管理员 '{username}' 创建成功")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python create_admin.py <用户名> <密码>")
        sys.exit(1)

    create_admin(sys.argv[1], sys.argv[2])
