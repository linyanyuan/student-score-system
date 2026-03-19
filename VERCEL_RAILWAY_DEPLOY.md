# Vercel + Railway 部署指南

## 📦 部署步骤

### 第一步：准备 GitHub 仓库

1. 将项目推送到 GitHub
```bash
cd D:\project\student-score-system
git add -A
git commit -m "prepare for deployment"
git remote add origin https://github.com/your-username/student-score-system.git
git push -u origin main
```

---

### 第二步：部署后端到 Railway

1. **注册 Railway**
   - 访问 https://railway.app
   - 使用 GitHub 账号登录

2. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的 `student-score-system` 仓库

3. **配置后端服务**
   - Root Directory: `backend`
   - 点击 "Deploy Now"
   - 等待部署完成（约2-3分钟）

4. **获取后端 URL**
   - 部署完成后，点击项目
   - 在 "Settings" → "Domains" 中生成域名
   - 复制这个 URL（例如：`https://student-score-backend-production.up.railway.app`）

5. **配置环境变量（可选）**
   - 在 "Variables" 中添加：
     - `SECRET_KEY`: 你的密钥
     - `DATABASE_URL`: `sqlite:///./student_score.db`

---

### 第三步：部署前端到 Vercel

1. **注册 Vercel**
   - 访问 https://vercel.com
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 选择你的 `student-score-system` 仓库
   - 点击 "Import"

3. **配置前端**
   - Project Name: `student-score-system`
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **添加环境变量**
   - 在 "Environment Variables" 中添加：
     - Name: `VITE_API_URL`
     - Value: `https://your-railway-backend-url.railway.app`（第二步获取的后端 URL）

5. **部署**
   - 点击 "Deploy"
   - 等待部署完成（约1-2分钟）

6. **获取前端 URL**
   - 部署完成后会显示访问地址（例如：`https://student-score-system.vercel.app`）

---

### 第四步：配置后端 CORS

1. 在 Railway 后端项目中添加环境变量：
   - Name: `CORS_ORIGINS`
   - Value: `https://your-vercel-app.vercel.app`（你的 Vercel 前端地址）

2. 或者修改 `backend/app/main.py`，添加你的 Vercel 域名到 CORS 配置中

---

## ✅ 验证部署

1. 访问你的 Vercel 前端地址
2. 尝试登录（默认账号：admin / admin123）
3. 测试各项功能

---

## 🔄 更新部署

每次代码更新后：
```bash
git add -A
git commit -m "update"
git push
```

Vercel 和 Railway 会自动重新部署！

---

## 💡 注意事项

1. **Railway 免费额度**：每月 500 小时运行时间，足够个人项目使用
2. **Vercel 免费额度**：无限带宽，100GB 存储
3. **数据库持久化**：Railway 需要配置 Volume 来持久化 SQLite 数据库
4. **首次访问慢**：Railway 免费版会休眠，首次访问需要等待唤醒（约10秒）

---

## 🐛 常见问题

### 1. 前端无法连接后端
- 检查 `VITE_API_URL` 环境变量是否正确
- 检查后端 CORS 配置

### 2. Railway 部署失败
- 检查 `requirements.txt` 是否完整
- 查看 Railway 部署日志

### 3. 数据库数据丢失
- Railway 需要配置 Volume 持久化存储
- 或者改用 PostgreSQL 数据库

---

## 📞 需要帮助？

如果遇到问题，可以：
1. 查看 Railway 和 Vercel 的部署日志
2. 检查浏览器控制台的错误信息
3. 确认环境变量配置正确
