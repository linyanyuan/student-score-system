#!/bin/bash

# 运行数据库迁移
alembic upgrade head

# 创建默认管理员（如果不存在）
python create_admin.py ${ADMIN_USERNAME:-admin} ${ADMIN_PASSWORD:-admin123} 2>/dev/null || true

# 启动应用
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
