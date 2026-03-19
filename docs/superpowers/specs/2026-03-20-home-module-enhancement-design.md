# 首页模块增强设计

日期: 2026-03-20

## 概述

本次迭代为首页模块增加三个核心功能：
1. **课表管理**：教师可查看和编辑一周课表，支持节次自定义配置
2. **备忘录**：教师个人待办事项管理，支持优先级、分类、截止日期
3. **每日励志语句**：通过第三方API展示每日一句

## 一、系统架构设计

### 1.1 整体架构
本次迭代在现有系统基础上新增三个独立模块：
- **课表管理模块**：节次配置 + 教师课表
- **备忘录模块**：教师个人待办事项
- **励志语句模块**：每日一句展示

三个模块相互独立，通过首页统一展示。

### 1.2 技术栈
- 后端：FastAPI + SQLAlchemy（与现有技术栈一致）
- 前端：React + Ant Design（与现有技术栈一致）
- 第三方API：一言API（https://v1.hitokoto.cn）

## 二、数据库设计

### 2.1 节次配置表 (schedule_periods)

```sql
CREATE TABLE schedule_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,           -- 节次名称，如"早自习"、"第1节"
    start_time TIME NOT NULL,            -- 开始时间，如"07:00"
    end_time TIME NOT NULL,              -- 结束时间，如"07:40"
    sort_order INTEGER NOT NULL,         -- 排序序号，决定显示顺序
    is_active BOOLEAN DEFAULT TRUE,      -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**默认数据**：
- 早自习：07:00-07:40
- 第1节：08:00-08:40
- 第2节：08:50-09:30
- 第3节：09:40-10:20
- 第4节：10:30-11:10
- 第5节：14:00-14:40
- 第6节：14:50-15:30
- 第7节：15:40-16:20
- 第8节：16:30-17:10
- 晚自习1：19:00-19:40
- 晚自习2：19:50-20:30
- 晚自习3：20:40-21:20

### 2.2 教师课表表 (teacher_schedules)

```sql
CREATE TABLE teacher_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,         -- 教师ID（关联users表）
    period_id INTEGER NOT NULL,          -- 节次ID（关联schedule_periods表）
    weekday INTEGER NOT NULL,            -- 星期几（1-5，周一到周五）
    class_id INTEGER,                    -- 班级ID（关联classes表，可为空）
    subject_id INTEGER,                  -- 科目ID（关联subjects表，可为空）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (period_id) REFERENCES schedule_periods(id),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    UNIQUE(teacher_id, period_id, weekday)  -- 同一教师同一节次同一天只能有一条记录
);
```

### 2.3 备忘录表 (memos)

```sql
CREATE TABLE memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,         -- 教师ID（关联users表）
    title VARCHAR(200) NOT NULL,         -- 标题
    description TEXT,                    -- 详细描述
    priority VARCHAR(20) DEFAULT 'medium', -- 优先级：high/medium/low
    category VARCHAR(50),                -- 分类：教学任务/会议/个人事项等
    status VARCHAR(20) DEFAULT 'pending', -- 状态：pending/completed
    due_date DATE,                       -- 截止日期
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);
```

### 2.4 每日语句缓存表 (daily_quotes)

```sql
CREATE TABLE daily_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,               -- 语句内容
    source VARCHAR(100),                 -- 来源
    date DATE NOT NULL UNIQUE,           -- 日期（用于缓存）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 三、后端API设计

### 3.1 节次配置管理 API

**基础路径**: `/api/schedule-periods`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 获取所有节次列表 | 所有用户 |
| POST | `/` | 创建节次 | 仅管理员 |
| PUT | `/{id}` | 更新节次 | 仅管理员 |
| DELETE | `/{id}` | 删除节次 | 仅管理员 |

**请求/响应示例**：

```json
// GET /api/schedule-periods
{
  "data": [
    {
      "id": 1,
      "name": "早自习",
      "start_time": "07:00",
      "end_time": "07:40",
      "sort_order": 1,
      "is_active": true
    }
  ]
}

// POST /api/schedule-periods
{
  "name": "第1节",
  "start_time": "08:00",
  "end_time": "08:40",
  "sort_order": 2
}
```

### 3.2 教师课表 API

**基础路径**: `/api/teacher-schedules`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/my-schedule` | 获取当前教师的课表 | 教师/管理员 |
| GET | `/{teacher_id}` | 获取指定教师的课表 | 仅管理员 |
| POST | `/` | 创建/更新课表项 | 教师/管理员 |
| DELETE | `/{id}` | 删除课表项 | 教师/管理员 |
| POST | `/batch` | 批量更新课表 | 教师/管理员 |

**请求/响应示例**：

```json
// GET /api/teacher-schedules/my-schedule
{
  "data": [
    {
      "id": 1,
      "period_id": 2,
      "period_name": "第1节",
      "start_time": "08:00",
      "end_time": "08:40",
      "weekday": 1,
      "class_id": 1,
      "class_name": "高一(1)班",
      "subject_id": 1,
      "subject_name": "数学"
    }
  ]
}

// POST /api/teacher-schedules/
{
  "period_id": 2,
  "weekday": 1,
  "class_id": 1,
  "subject_id": 1
}
```

### 3.3 备忘录 API

**基础路径**: `/api/memos`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 获取当前教师的备忘录列表 | 教师/管理员 |
| POST | `/` | 创建备忘录 | 教师/管理员 |
| PUT | `/{id}` | 更新备忘录 | 教师/管理员 |
| DELETE | `/{id}` | 删除备忘录 | 教师/管理员 |
| PATCH | `/{id}/status` | 更新备忘录状态 | 教师/管理员 |

**请求/响应示例**：

```json
// GET /api/memos?status=pending&limit=5
{
  "data": [
    {
      "id": 1,
      "title": "准备期中考试试卷",
      "description": "需要准备高一数学期中考试试卷",
      "priority": "high",
      "category": "教学任务",
      "status": "pending",
      "due_date": "2026-03-25",
      "created_at": "2026-03-20T10:00:00"
    }
  ]
}

// POST /api/memos
{
  "title": "批改作业",
  "description": "批改高一(1)班数学作业",
  "priority": "medium",
  "category": "教学任务",
  "due_date": "2026-03-22"
}

// PATCH /api/memos/1/status
{
  "status": "completed"
}
```

### 3.4 每日语句 API

**基础路径**: `/api/daily-quote`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 获取今日语句（优先缓存，缓存失效则调用API） | 所有用户 |

**响应示例**：

```json
// GET /api/daily-quote
{
  "content": "成功不是终点，失败也不是末日：重要的是继续前进的勇气。",
  "source": "温斯顿·丘吉尔"
}
```

**实现逻辑**：
1. 检查数据库是否有今天的缓存
2. 有缓存直接返回
3. 无缓存则调用一言API，存入数据库后返回
4. API调用失败返回默认语句

## 四、前端页面设计

### 4.1 首页布局 (Home.jsx)

```
┌─────────────────────────────────────────────────────────────┐
│  励志语句区域（全宽，顶部）                                    │
│  "成功不是终点，失败也不是末日：重要的是继续前进的勇气。"      │
│  — 温斯顿·丘吉尔                                              │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│  课表区域（左侧，60%）         │  备忘录区域（右侧，40%）       │
│                              │                              │
│  周一  周二  周三  周四  周五  │  [+ 新建备忘录]               │
│  ┌───┬───┬───┬───┬───┐      │                              │
│  │早 │   │   │   │   │      │  ● 高优先级任务               │
│  │自 │   │   │   │   │      │  □ 准备期中考试试卷           │
│  │习 │   │   │   │   │      │    截止：2026-03-25          │
│  ├───┼───┼───┼───┼───┤      │                              │
│  │1  │数 │数 │   │数 │      │  ● 中优先级任务               │
│  │   │学 │学 │   │学 │      │  □ 批改作业                   │
│  │   │1班│2班│   │1班│      │    截止：2026-03-22          │
│  ├───┼───┼───┼───┼───┤      │                              │
│  │2  │   │   │   │   │      │  ● 低优先级任务               │
│  │...│   │   │   │   │      │  ☑ 整理教案（已完成）         │
│  └───┴───┴───┴───┴───┘      │                              │
│                              │                              │
│  [编辑课表]                   │  [查看全部]                   │
└──────────────────────────────┴──────────────────────────────┘
```

**组件结构**：
- `DailyQuote`：励志语句组件
- `WeeklySchedule`：课表展示组件
- `MemoList`：备忘录列表组件

### 4.2 节次配置页面 (SchedulePeriodManage.jsx)

管理员专用页面，用于配置全校统一的节次时间表。

**功能**：
- 表格展示所有节次（名称、开始时间、结束时间、排序）
- 支持新增、编辑、删除、启用/禁用
- 拖拽排序调整显示顺序

**路由**：`/schedule-period-manage`

### 4.3 课表编辑页面 (ScheduleEdit.jsx)

教师编辑自己的课表，管理员可编辑所有教师课表。

**功能**：
- 表格形式展示一周课表（行：节次，列：星期）
- 点击格子弹出编辑框，选择班级和科目
- 支持快速清空某个格子
- 保存后实时更新

**路由**：`/schedule-edit`

### 4.4 备忘录管理 (MemoManage.jsx)

独立页面，展示完整的备忘录列表和详细操作。

**功能**：
- 列表展示所有备忘录（按优先级和截止日期排序）
- 支持筛选（按状态、优先级、分类）
- 支持搜索（按标题）
- 新建、编辑、删除、标记完成

**路由**：`/memo-manage`

### 4.5 响应式布局

- **大屏 (>1200px)**：课表60% + 备忘录40%
- **中屏 (768-1200px)**：课表50% + 备忘录50%
- **小屏 (<768px)**：上下堆叠，课表在上，备忘录在下

## 五、核心业务逻辑

### 5.1 课表编辑逻辑

**编辑流程**：
1. 教师点击课表格子
2. 弹出对话框，显示当前节次信息
3. 从下拉框选择班级（来自 teacher_classes 表，只显示该教师任教的班级）
4. 从下拉框选择科目（来自 subjects 表）
5. 保存时调用 `POST /api/teacher-schedules/`，后端使用 UPSERT 逻辑（存在则更新，不存在则创建）

**权限控制**：
- 教师只能编辑自己的课表
- 管理员可以编辑任何教师的课表
- 后端通过 JWT token 验证身份

**数据验证**：
- 班级必须是该教师任教的班级
- 科目必须存在于系统中
- 节次必须是启用状态

### 5.2 备忘录排序逻辑

**首页显示规则**（最多显示5条）：
1. 未完成的备忘录优先
2. 按优先级排序：high > medium > low
3. 同优先级按截止日期升序（最近的在前）
4. 无截止日期的排在最后

**完整列表页排序**：
- 支持用户自定义排序（按创建时间、截止日期、优先级）
- 已完成的备忘录默认折叠或置底

**优先级颜色标识**：
- high：红色（#ff4d4f）
- medium：橙色（#faad14）
- low：绿色（#52c41a）

### 5.3 每日语句缓存策略

**缓存逻辑**：
```python
def get_daily_quote():
    today = date.today()
    # 1. 查询今天的缓存
    cached = db.query(DailyQuote).filter(DailyQuote.date == today).first()
    if cached:
        return cached

    # 2. 调用一言API
    try:
        response = requests.get("https://v1.hitokoto.cn", timeout=3)
        data = response.json()
        quote = DailyQuote(
            content=data['hitokoto'],
            source=data.get('from', ''),
            date=today
        )
        db.add(quote)
        db.commit()
        return quote
    except:
        # 3. API失败，返回默认语句
        return {
            "content": "教育的目的是让学生能够进行自我教育。",
            "source": "默认"
        }
```

**清理策略**：
- 定期清理30天前的缓存记录（可通过定时任务实现）

**默认语句库**（API失败时使用）：
```python
DEFAULT_QUOTES = [
    {"content": "教育的目的是让学生能够进行自我教育。", "source": "默认"},
    {"content": "教师的工作是激发学生对知识的渴望。", "source": "默认"},
    {"content": "好的教育不是灌输知识，而是点燃火焰。", "source": "默认"},
]
```

## 六、错误处理与边界情况

### 6.1 课表模块

**边界情况**：
- 教师没有任教班级：课表编辑时班级下拉框为空，提示"请先分配任教班级"
- 删除节次时已有课表引用：提示"该节次已被使用，无法删除"，需先清空相关课表
- 同一时间段重复排课：允许（教师可能需要记录备选课程）
- 节次时间冲突：管理员配置时前端校验，不允许时间段重叠

**错误处理**：
- API调用失败：显示错误提示，不影响其他功能
- 保存课表失败：回滚到上一次保存的状态
- 网络超时：显示"保存失败，请重试"

### 6.2 备忘录模块

**边界情况**：
- 截止日期已过：标记为红色，排序时置顶
- 标题为空：前端校验，必填项
- 描述过长：限制10000字符
- 删除已完成的备忘录：二次确认

**错误处理**：
- 创建失败：显示具体错误信息
- 状态更新失败：保持原状态，提示用户
- 批量操作部分失败：显示成功和失败的数量

### 6.3 每日语句模块

**边界情况**：
- 一言API不可用：返回默认语句，不影响页面加载
- API返回数据格式异常：捕获异常，使用默认语句
- 缓存表为空且API失败：使用硬编码的默认语句数组（随机返回一条）

**错误处理**：
- 静默失败，不向用户显示错误
- 记录日志供管理员排查
- 确保首页始终能正常显示

### 6.4 权限控制

**验证规则**：
- 学生角色访问课表/备忘录API：返回403 Forbidden
- 教师编辑其他教师的课表：返回403 Forbidden
- 教师访问节次配置管理：返回403 Forbidden
- Token过期或无效：返回401 Unauthorized，前端跳转登录页

## 七、测试验收标准

### 7.1 节次配置管理

**功能测试**：
- ✓ 管理员可以创建节次（名称、开始时间、结束时间）
- ✓ 管理员可以编辑节次信息
- ✓ 管理员可以删除未被使用的节次
- ✓ 删除已被使用的节次时显示错误提示
- ✓ 节次按排序序号正确显示
- ✓ 教师和学生无法访问节次配置页面

### 7.2 教师课表

**功能测试**：
- ✓ 教师登录后首页左侧显示本周课表
- ✓ 课表格子显示"班级名-科目名"格式
- ✓ 点击"编辑课表"进入编辑页面
- ✓ 点击课表格子可以选择班级和科目
- ✓ 班级下拉框只显示该教师任教的班级
- ✓ 保存后课表立即更新
- ✓ 管理员可以查看和编辑任何教师的课表
- ✓ 教师无法编辑其他教师的课表

### 7.3 备忘录

**功能测试**：
- ✓ 首页右侧显示最多5条未完成备忘录
- ✓ 备忘录按优先级和截止日期正确排序
- ✓ 高优先级显示红色标签，中优先级橙色，低优先级绿色
- ✓ 可以创建备忘录（标题、描述、优先级、分类、截止日期）
- ✓ 可以标记备忘录为完成状态
- ✓ 可以编辑和删除备忘录
- ✓ 截止日期已过的备忘录显示红色提示
- ✓ 点击"查看全部"进入完整备忘录管理页面

### 7.4 每日语句

**功能测试**：
- ✓ 首页顶部显示励志语句
- ✓ 每天显示不同的语句（缓存机制）
- ✓ 一言API不可用时显示默认语句
- ✓ 语句显示来源信息

### 7.5 响应式布局

**UI测试**：
- ✓ 大屏（>1200px）：课表60%，备忘录40%
- ✓ 中屏（768-1200px）：课表50%，备忘录50%
- ✓ 小屏（<768px）：上下堆叠显示
- ✓ 各种屏幕尺寸下内容可读性良好

### 7.6 性能测试

- ✓ 首页加载时间 < 2秒
- ✓ 课表编辑保存响应 < 500ms
- ✓ 备忘录操作响应 < 500ms
- ✓ 每日语句API超时设置为3秒

## 八、实施计划

### 8.1 数据库迁移
1. 创建4个新表的迁移脚本
2. 插入默认节次数据
3. 执行迁移

### 8.2 后端开发
1. 创建模型类（SchedulePeriod, TeacherSchedule, Memo, DailyQuote）
2. 创建Schema类（请求/响应验证）
3. 实现4个路由模块（schedule_periods, teacher_schedules, memos, daily_quote）
4. 添加权限验证装饰器
5. 集成一言API

### 8.3 前端开发
1. 创建API请求函数（4个模块）
2. 实现首页组件重构（DailyQuote, WeeklySchedule, MemoList）
3. 实现节次配置管理页面
4. 实现课表编辑页面
5. 实现备忘录管理页面
6. 添加路由配置
7. 实现响应式布局

### 8.4 测试与优化
1. 单元测试（后端API）
2. 集成测试（前后端联调）
3. UI测试（响应式布局）
4. 性能测试
5. 用户验收测试

## 九、注意事项

1. **数据迁移**：确保在生产环境执行迁移前备份数据库
2. **API限流**：一言API无需认证，但建议添加本地缓存避免频繁调用
3. **时区处理**：时间字段统一使用服务器时区，前端显示时转换为本地时区
4. **权限验证**：所有API都需要验证用户身份和权限
5. **错误日志**：记录所有API调用失败的详细日志，便于排查问题
6. **前端状态管理**：课表和备忘录数据使用React状态管理，避免频繁请求
7. **移动端适配**：确保小屏设备上的操作体验良好
