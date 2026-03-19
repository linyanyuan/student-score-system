#!/bin/bash

# 运行数据库迁移
alembic upgrade head

# 启动应用
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
