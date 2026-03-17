# 学生信息管理 & 学生成绩管理 设计文档

**目标**：实现学生信息的增删改查、Excel 导入导出、自定义字段管理，以及学生成绩的录入、维护、查询、排名对比和 Excel 导入导出。

**依赖**：登录注册模块（已完成）

**参考文档**：
- `docs/项目需求文档1.1.md` — 2.2 学生信息管理、2.3 学生成绩管理
- `docs/技术方案1.2.md` — 数据库设计、接口设计

---

## 一、数据库设计

### 1. 班级表 (classes)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | VARCHAR(50) | 班级名称，如"高三(1)班"，唯一 |
| grade | VARCHAR(20) | 年级，如"高三" |

### 2. 科目表 (subjects)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | VARCHAR(50) | 科目名称，如"数学"，唯一 |
| code | VARCHAR(20) | 科目代码，如"MATH" |

### 3. 教师-班级关联表 (teacher_classes)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| teacher_id | INTEGER FK | 关联 users.id |
| class_id | INTEGER FK | 关联 classes.id |
| 联合唯一约束 | | (teacher_id, class_id) |

### 4. 自定义字段定义表 (custom_field_definitions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| field_name | VARCHAR(50) | 字段名称，如"民族"，唯一 |
| field_type | VARCHAR(20) | 类型：text/number/date/select |
| options | TEXT | 下拉选项 JSON，如 `["汉族","回族",...]`，仅 select 类型使用 |
| sort_order | INTEGER | 排序序号 |
| created_at | TIMESTAMP | 创建时间 |

### 5. 学生表 (students)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| student_no | VARCHAR(20) | 学号，唯一 |
| name | VARCHAR(50) | 姓名 |
| gender | CHAR(1) | 性别：M/F |
| birth_date | DATE | 出生日期 |
| class_id | INTEGER FK | 关联 classes.id |
| phone | VARCHAR(20) | 联系方式 |
| custom_fields | TEXT | 自定义字段值 JSON，如 `{"民族":"汉族","籍贯":"北京"}` |
| created_at | TIMESTAMP | 创建时间 |

### 6. 考试表 (exams)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | VARCHAR(100) | 考试名称，如"期中考试" |
| exam_date | DATE | 考试日期 |
| grade | VARCHAR(20) | 参与年级 |
| description | TEXT | 描述（可选） |

### 7. 成绩表 (scores)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| student_id | INTEGER FK | 关联 students.id |
| exam_id | INTEGER FK | 关联 exams.id |
| subject_id | INTEGER FK | 关联 subjects.id |
| score | FLOAT | 分数 |
| created_at | TIMESTAMP | 创建时间 |
| 联合唯一约束 | | (student_id, exam_id, subject_id) |

### 8. 总分排名表 (total_ranks)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| student_id | INTEGER FK | 关联 students.id |
| exam_id | INTEGER FK | 关联 exams.id |
| total_score | FLOAT | 总分 |
| rank_class | INTEGER | 班级排名 |
| rank_grade | INTEGER | 年级排名 |
| created_at | TIMESTAMP | 创建时间 |
| 联合唯一约束 | | (student_id, exam_id) |

### 排名计算逻辑

每次成绩录入/修改/删除后，触发该考试的排名重新计算：
1. 按考试汇总每个学生的各科总分
2. 按班级分组排序，计算 `rank_class`
3. 按年级（考试的 grade 字段）排序，计算 `rank_grade`
4. 写入/更新 `total_ranks` 表

---

## 二、后端 API 设计

### 权限中间件

新增角色权限依赖注入：
- `require_admin` — 仅管理员可访问
- `require_teacher_or_admin` — 管理员或教师可访问
- `get_accessible_classes(current_user)` — 管理员返回所有班级，教师返回其关联班级

### 班级管理 API（`/api/classes`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/classes` | 所有登录用户 | 班级列表（教师仅返回关联班级） |
| POST | `/api/classes` | 管理员 | 新增班级 |
| PUT | `/api/classes/{id}` | 管理员 | 修改班级 |
| DELETE | `/api/classes/{id}` | 管理员 | 删除班级（有学生关联时禁止删除） |

### 科目管理 API（`/api/subjects`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/subjects` | 所有登录用户 | 科目列表 |
| POST | `/api/subjects` | 管理员 | 新增科目 |
| PUT | `/api/subjects/{id}` | 管理员 | 修改科目 |
| DELETE | `/api/subjects/{id}` | 管理员 | 删除科目（有成绩关联时禁止删除） |

### 教师-班级关联 API（`/api/teacher-classes`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/teacher-classes` | 管理员 | 查询教师-班级关联列表 |
| POST | `/api/teacher-classes` | 管理员 | 分配教师到班级 |
| DELETE | `/api/teacher-classes/{id}` | 管理员 | 取消关联 |

### 自定义字段定义 API（`/api/custom-fields`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/custom-fields` | 所有登录用户 | 获取字段定义列表 |
| POST | `/api/custom-fields` | 管理员 | 新增字段定义 |
| PUT | `/api/custom-fields/{id}` | 管理员 | 修改字段定义 |
| DELETE | `/api/custom-fields/{id}` | 管理员 | 删除字段定义 |

### 学生管理 API（`/api/students`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/students` | 管理员/教师 | 分页查询，支持按学号、姓名、班级过滤；教师仅查看关联班级学生 |
| GET | `/api/students/{id}` | 管理员/教师 | 获取单个学生详情 |
| POST | `/api/students` | 管理员/教师 | 新增学生 |
| PUT | `/api/students/{id}` | 管理员/教师 | 修改学生信息 |
| DELETE | `/api/students/{id}` | 管理员 | 删除学生 |
| POST | `/api/students/import` | 管理员/教师 | Excel 批量导入 |
| GET | `/api/students/export` | 管理员/教师 | 导出 Excel |
| GET | `/api/students/template` | 管理员/教师 | 下载导入模板 |

### 考试管理 API（`/api/exams`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/exams` | 所有登录用户 | 考试列表，支持按年级过滤 |
| POST | `/api/exams` | 管理员 | 新增考试 |
| PUT | `/api/exams/{id}` | 管理员 | 修改考试 |
| DELETE | `/api/exams/{id}` | 管理员 | 删除考试（有成绩关联时禁止删除） |

### 成绩管理 API（`/api/scores`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/scores` | 管理员/教师/学生 | 分页查询成绩列表 |
| POST | `/api/scores` | 管理员/教师 | 录入单条成绩，触发排名重算 |
| PUT | `/api/scores/{id}` | 管理员/教师 | 修改成绩，触发排名重算 |
| DELETE | `/api/scores/{id}` | 管理员 | 删除成绩，触发排名重算 |
| POST | `/api/scores/import` | 管理员/教师 | Excel 批量导入，批量完成后统一重算排名 |
| GET | `/api/scores/export` | 管理员/教师 | 导出 Excel |
| GET | `/api/scores/template` | 管理员/教师 | 下载导入模板 |

### GET `/api/scores` 查询参数与返回

查询参数：
- `exam_id`（必填）— 指定考试
- `class_id`（可选）— 按班级过滤，教师仅可查看关联班级
- `student_id`（可选）— 按学生过滤，学生角色自动锁定为本人
- `page`、`page_size`、`sort_by`、`sort_order`

返回格式：
```json
{
  "items": [
    {
      "student_id": 1,
      "student_no": "2024001",
      "student_name": "张三",
      "class_name": "高三(1)班",
      "subjects": { "语文": 85, "数学": 92, "英语": 78 },
      "total_score": 255,
      "rank_class": 3,
      "rank_grade": 15,
      "prev_total_score": 240,
      "prev_rank_class": 5,
      "prev_rank_grade": 20,
      "rank_class_change": "↑2",
      "rank_grade_change": "↑5"
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20
}
```

### 分页统一格式

所有分页查询使用统一参数：`page`（默认1）、`page_size`（默认20）、`sort_by`、`sort_order`（asc/desc）。

返回格式统一为 `{ items, total, page, page_size }`。

### 权限细节

- **管理员**：所有操作
- **教师**：查看/操作关联班级的学生和成绩
- **学生**：仅查看自己的成绩，`student_id` 自动锁定

---

## 三、前端设计

### 主布局（MainLayout）

使用 Ant Design `Layout` 组件替换当前简单的 Home 组件：

- **侧边栏（Sider）**：可折叠，根据用户角色动态显示菜单项
  - 管理员：首页、班级管理、科目管理、考试管理、教师-班级分配、自定义字段管理、学生管理、成绩管理
  - 教师：首页、学生管理、成绩管理
  - 学生：首页、成绩查询
- **顶部栏（Header）**：显示系统名称、当前用户名、角色、退出按钮
- **内容区（Content）**：路由渲染区域

### 页面清单

| 页面 | 文件 | 角色 | 说明 |
|------|------|------|------|
| 首页 | Home.jsx | 所有 | 从 App.jsx 提取，欢迎页 |
| 班级管理 | ClassManage.jsx | 管理员 | Table + Modal CRUD |
| 科目管理 | SubjectManage.jsx | 管理员 | Table + Modal CRUD |
| 考试管理 | ExamManage.jsx | 管理员 | Table + Modal CRUD |
| 教师-班级分配 | TeacherClassManage.jsx | 管理员 | 选择教师，分配/移除班级 |
| 自定义字段管理 | CustomFieldManage.jsx | 管理员 | Table + Modal，select 类型含选项配置 |
| 学生管理 | StudentManage.jsx | 管理员/教师 | 筛选栏 + Table + Drawer 表单 + Excel 导入导出 |
| 成绩管理 | ScoreManage.jsx | 所有 | 筛选栏 + 动态列 Table + Modal 录入 + 排名升降渲染 + Excel 导入导出 |

### 前端文件结构

```
frontend/src/
├── components/
│   ├── ProtectedRoute.jsx          (已有)
│   └── MainLayout.jsx              (新增：主布局)
├── pages/
│   ├── Login.jsx                   (已有)
│   ├── Register.jsx                (已有)
│   ├── Home.jsx                    (新增：从 App.jsx 提取)
│   ├── ClassManage.jsx             (新增)
│   ├── SubjectManage.jsx           (新增)
│   ├── ExamManage.jsx              (新增)
│   ├── TeacherClassManage.jsx      (新增)
│   ├── CustomFieldManage.jsx       (新增)
│   ├── StudentManage.jsx           (新增)
│   └── ScoreManage.jsx             (新增)
├── api/
│   ├── request.js                  (已有)
│   ├── class.js                    (新增)
│   ├── subject.js                  (新增)
│   ├── exam.js                     (新增)
│   ├── teacherClass.js             (新增)
│   ├── customField.js              (新增)
│   ├── student.js                  (新增)
│   └── score.js                    (新增)
├── contexts/
│   └── AuthContext.jsx             (已有)
└── App.jsx                         (修改：新增路由 + 布局)
```

### 路由设计

```
/login              → Login（公开）
/register           → Register（公开）
/                   → MainLayout > Home（需登录）
/classes            → MainLayout > ClassManage（管理员）
/subjects           → MainLayout > SubjectManage（管理员）
/exams              → MainLayout > ExamManage（管理员）
/teacher-classes    → MainLayout > TeacherClassManage（管理员）
/custom-fields      → MainLayout > CustomFieldManage（管理员）
/students           → MainLayout > StudentManage（管理员/教师）
/scores             → MainLayout > ScoreManage（管理员/教师/学生）
```

---

## 四、错误处理

- Excel 导入失败时返回行级错误信息，前端用 Modal 展示成功/失败详情
- 删除受关联保护的数据时（如有学生的班级、有成绩的考试）返回清晰错误信息
- 排名计算失败不阻塞成绩录入，记录日志后提示用户排名可能需要手动刷新
- 权限不足时返回 403，前端对应提示
- 重复数据（如重复学号、重复成绩记录）返回 400 及具体说明
