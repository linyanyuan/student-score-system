# 登录注册模块 - 设计文档

## 概述

学生成绩管理系统的第一个模块：登录注册功能。包含用户注册、用户登录、身份验证三个核心功能，同时搭建前后端项目骨架。

**技术选型确认**：
- 构建工具：Vite
- Token 存储：localStorage
- 密码要求：至少 6 位字符
- 状态管理：React Context
- 认证方案：标准 JWT（单 Access Token，有效期 7 天）

## 1. 项目结构

```
student-score-system/
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 应用入口，挂载路由和中间件
│   │   ├── config.py            # 配置（SECRET_KEY, DB路径, Token过期时间等）
│   │   ├── database.py          # SQLAlchemy 引擎和 Session 工厂
│   │   ├── models/              # SQLAlchemy 数据模型
│   │   │   ├── __init__.py
│   │   │   └── user.py          # User 模型
│   │   ├── schemas/             # Pydantic 请求/响应模型
│   │   │   ├── __init__.py
│   │   │   └── auth.py          # 注册、登录、用户信息的 Schema
│   │   ├── routers/             # API 路由
│   │   │   ├── __init__.py
│   │   │   └── auth.py          # /api/auth/* 路由
│   │   ├── dependencies.py      # 依赖注入（获取当前用户等）
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── security.py      # JWT 生成/验证、密码哈希/校验
│   ├── alembic/                 # 数据库迁移
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/                    # React 前端（Vite）
│   ├── src/
│   │   ├── main.jsx             # 应用入口
│   │   ├── App.jsx              # 根组件，路由配置
│   │   ├── api/
│   │   │   └── request.js       # Axios 实例，拦截器配置
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx  # 认证上下文
│   │   ├── pages/
│   │   │   ├── Login.jsx        # 登录页
│   │   │   └── Register.jsx     # 注册页
│   │   └── components/
│   │       └── ProtectedRoute.jsx  # 路由守卫组件
│   ├── package.json
│   └── vite.config.js
└── docs/                        # 已有文档
```

后端按 models / schemas / routers / utils 分层，前端按 api / contexts / pages / components 组织。后续模块只需在对应层添加文件即可扩展。

## 2. 后端数据模型与 API

### 2.1 用户模型（User）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer, PK, 自增 | 主键 |
| username | String(50), 唯一, 非空 | 用户名 |
| password_hash | String(200), 非空 | bcrypt 哈希密码 |
| role | String(20), 非空 | `admin` / `teacher` / `student` |
| created_at | DateTime, 默认当前时间 | 创建时间 |
| is_active | Boolean, 默认 True | 保留字段 |

### 2.2 API 端点

**POST /api/auth/register**
- 请求体：`{ username, password, role }`
- 校验：username 不能重复，role 只能是 `teacher` 或 `student`，密码至少 6 位
- 返回：`{ id, username, role, created_at }`
- 无需认证

**POST /api/auth/login**
- 请求体：`{ username, password }`
- 校验：用户名存在且密码匹配
- 返回：`{ access_token, token_type: "bearer" }`
- Token 有效期 7 天，payload 包含 `{ sub: username, role: role }`

**GET /api/auth/me**
- 请求头：`Authorization: Bearer <token>`
- 返回：`{ id, username, role, created_at }`
- 需要认证

### 2.3 安全工具（security.py）

- `hash_password(password)` — bcrypt 哈希
- `verify_password(plain, hashed)` — 验证密码
- `create_access_token(data, expires_delta)` — 生成 JWT
- `decode_access_token(token)` — 解析 JWT

### 2.4 依赖注入（dependencies.py）

- `get_current_user(token)` — 从 Authorization 头解析 Token，查询数据库返回用户对象；Token 无效或过期返回 401

## 3. 前端实现

### 3.1 Axios 封装（api/request.js）

- 创建 Axios 实例，baseURL 设为 `/api`
- 请求拦截器：从 localStorage 读取 token，自动附加 `Authorization: Bearer <token>` 头
- 响应拦截器：遇到 401 状态码时清除 token 并跳转到登录页

### 3.2 认证上下文（AuthContext）

| 属性/方法 | 说明 |
|-----------|------|
| `user` | 当前用户对象（null 表示未登录） |
| `loading` | 初始化加载状态（用于首次进入时校验 token） |
| `login(username, password)` | 调用登录 API，存储 token，获取用户信息 |
| `register(username, password, role)` | 调用注册 API |
| `logout()` | 清除 token 和用户状态 |

初始化逻辑：组件挂载时检查 localStorage 是否有 token，有则调用 `GET /api/auth/me` 验证有效性并获取用户信息；无效则清除。

### 3.3 页面设计

**登录页（Login.jsx）**：
- Ant Design Form 组件，包含用户名、密码两个输入框和登录按钮
- 底部有"没有账号？去注册"的链接跳转到注册页
- 登录成功后跳转到首页（/）

**注册页（Register.jsx）**：
- Ant Design Form 组件，包含用户名、密码、确认密码、角色选择（Select，选项为教师/学生）
- 底部有"已有账号？去登录"的链接
- 注册成功后跳转到登录页，并提示"注册成功，请登录"

### 3.4 路由设计

| 路径 | 组件 | 说明 |
|------|------|------|
| `/login` | Login | 登录页，未登录可访问 |
| `/register` | Register | 注册页，未登录可访问 |
| `/` | 首页（占位） | 需要登录，被 ProtectedRoute 保护 |

ProtectedRoute 组件：检查 AuthContext 中的 user 状态，未登录则重定向到 /login；loading 时显示加载状态。

### 3.5 Vite 代理

vite.config.js 中配置 `/api` 代理到后端 `http://localhost:8000`，解决开发环境跨域问题。

## 4. 错误处理与边界情况

### 4.1 后端错误响应

统一错误响应格式：`{ "detail": "错误描述信息" }`

| 场景 | HTTP 状态码 | detail |
|------|------------|--------|
| 用户名已存在 | 400 | 用户名已被注册 |
| 角色不合法（如传入 admin） | 400 | 仅允许注册教师或学生角色 |
| 密码长度不足 6 位 | 422 | Pydantic 验证自动返回 |
| 用户名或密码错误 | 401 | 用户名或密码错误 |
| Token 无效或过期 | 401 | 无效的认证凭据 |
| 请求体格式错误 | 422 | FastAPI 自动返回验证错误 |

### 4.2 前端错误处理

- 登录/注册表单使用 Ant Design Form 的内置校验（必填、最小长度等），在提交前拦截
- API 返回错误时通过 `message.error()` 显示后端返回的 detail 信息
- 网络异常时显示"网络连接失败，请检查网络"

### 4.3 边界情况

- 重复提交：登录/注册按钮提交后设为 loading 状态，防止重复点击
- Token 过期：Axios 响应拦截器捕获 401，自动清除状态并跳转登录页
- 已登录用户访问登录页：如果 user 已存在，自动重定向到首页
