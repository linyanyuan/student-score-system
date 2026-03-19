# 学生成绩管理系统 - 部署指南

## 部署方式

### 方式一：Docker 部署（推荐）

#### 前置要求
- 安装 Docker 和 Docker Compose
- 服务器开放 80 和 8000 端口

#### 部署步骤

1. 将项目上传到服务器
```bash
# 使用 git 克隆或直接上传
git clone <your-repo-url>
cd student-score-system
```

2. 初始化数据库
```bash
cd backend
python create_admin.py  # 创建管理员账户
cd ..
```

3. 启动服务
```bash
docker-compose up -d
```

4. 查看日志
```bash
docker-compose logs -f
```

5. 停止服务
```bash
docker-compose down
```

#### 访问地址
- 前端：http://your-server-ip
- 后端 API：http://your-server-ip:8000

---

### 方式二：传统部署

#### 后端部署

1. 安装 Python 3.11+
```bash
cd backend
pip install -r requirements.txt
```

2. 初始化数据库
```bash
python create_admin.py
alembic upgrade head
```

3. 启动后端（使用 gunicorn）
```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

#### 前端部署

1. 安装 Node.js 18+
```bash
cd frontend
npm install
```

2. 修改 API 地址
编辑 `src/api/request.js`，将 `baseURL` 改为后端地址：
```javascript
const request = axios.create({
  baseURL: 'http://your-server-ip:8000',
  timeout: 10000,
})
```

3. 构建前端
```bash
npm run build
```

4. 部署到 Nginx
```bash
# 将 dist 目录内容复制到 nginx 目录
cp -r dist/* /usr/share/nginx/html/
```

5. 配置 Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### 方式三：云平台部署

#### Vercel（前端）+ Railway/Render（后端）

**前端部署到 Vercel：**
1. 注册 Vercel 账号
2. 连接 GitHub 仓库
3. 选择 frontend 目录
4. 设置环境变量 `VITE_API_URL`
5. 自动部署

**后端部署到 Railway：**
1. 注册 Railway 账号
2. 新建项目，连接 GitHub
3. 选择 backend 目录
4. 添加 SQLite 数据卷
5. 自动部署

---

## 生产环境配置建议

### 1. 使用 PostgreSQL 替代 SQLite
修改 `backend/app/config.py`：
```python
DATABASE_URL = "postgresql://user:password@localhost/dbname"
```

### 2. 配置 HTTPS
使用 Let's Encrypt 免费证书：
```bash
certbot --nginx -d your-domain.com
```

### 3. 设置环境变量
创建 `.env` 文件：
```
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./student_score.db
CORS_ORIGINS=https://your-domain.com
```

### 4. 启用日志
```python
import logging
logging.basicConfig(level=logging.INFO)
```

### 5. 定期备份数据库
```bash
# 添加到 crontab
0 2 * * * cp /path/to/student_score.db /path/to/backup/
```

---

## 常见问题

### 1. 端口被占用
```bash
# 修改 docker-compose.yml 中的端口映射
ports:
  - "8080:80"  # 前端改为 8080
```

### 2. 数据库权限问题
```bash
chmod 666 backend/student_score.db
```

### 3. CORS 错误
检查 `backend/app/main.py` 中的 CORS 配置

---

## 性能优化

1. 启用 Nginx gzip 压缩
2. 使用 CDN 加速静态资源
3. 数据库添加索引
4. 使用 Redis 缓存
5. 启用后端多进程

---

## 监控和维护

1. 使用 PM2 管理进程
2. 配置日志轮转
3. 设置健康检查
4. 监控服务器资源

---

## 联系方式

如有问题，请查看项目文档或提交 Issue。
