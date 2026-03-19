#!/bin/bash

# 调试：显示 PORT 环境变量
echo "=== Environment Debug ==="
echo "PORT=${PORT}"
echo "========================"

# 运行数据库迁移
alembic upgrade head

# 创建默认管理员（如果不存在）
python create_admin.py ${ADMIN_USERNAME:-admin} ${ADMIN_PASSWORD:-admin123} 2>/dev/null || true

# 启动应用
echo "Starting uvicorn on port ${PORT:-8000}"
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
