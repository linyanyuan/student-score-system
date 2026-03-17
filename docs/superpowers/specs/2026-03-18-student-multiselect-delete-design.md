# 学生管理模块 - 多选批量删除功能设计文档

**日期：** 2026-03-18
**状态：** 已批准

---

## 概述

在学生管理模块的表格中添加多选功能，并提供"删除所选"按钮，支持批量删除学生记录。

---

## 需求

- 表格支持多选（checkbox）
- 选中记录后显示"删除所选 (N)"按钮
- 未选中任何记录时隐藏该按钮
- 点击按钮弹出确认提示，确认后批量删除
- 删除成功后清空选中状态并刷新列表

---

## 架构设计

### 后端

**新增接口：** `DELETE /api/students/batch`

- **请求体：** `{ "ids": [1, 2, 3] }`
- **响应：** `{ "deleted_count": 3 }`
- **权限控制：** 与单删除一致，仅删除当前用户有权访问的学生（无权限的 ID 跳过）
- **事务处理：** 所有删除在同一数据库事务中完成

**变更文件：**
- `backend/app/routers/students.py` — 新增 `batch_delete_students` 路由处理函数
- `backend/app/schemas/student.py` — 新增 `BatchDeleteRequest` schema

### 前端

**状态变更（`StudentManage.jsx`）：**
- 新增 `selectedRowKeys` state（`useState([])`）
- Table 添加 `rowSelection` 属性

**UI 变更：**
- 工具栏在 `selectedRowKeys.length > 0` 时显示"删除所选 (N)"按钮（`danger` 样式）
- 点击后弹出 `Popconfirm` 确认，确认后调用批量删除 API
- 成功后调用 `setSelectedRowKeys([])` 清空选中，并 `fetchData()` 刷新列表

**API 层（`src/api/student.js`）：**
- 新增 `deleteStudents(ids)` — `DELETE /api/students/batch`，请求体 `{ ids }`

---

## 数据流

```
用户勾选行
  → selectedRowKeys 更新
  → 工具栏显示"删除所选 (N)"按钮

用户点击"删除所选"
  → Popconfirm 确认弹窗
  → 确认 → deleteStudents(selectedRowKeys)
  → DELETE /api/students/batch { ids: [...] }
  → 后端批量删除（权限过滤，单事务）
  → 返回 { deleted_count: N }
  → setSelectedRowKeys([]) + fetchData()
  → 表格刷新，选中状态清空
```

---

## 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/app/routers/students.py` | 新增路由 | 批量删除接口 |
| `backend/app/schemas/student.py` | 新增 schema | `BatchDeleteRequest` |
| `frontend/src/api/student.js` | 新增函数 | `deleteStudents` |
| `frontend/src/pages/StudentManage.jsx` | 修改 | 多选状态、rowSelection、删除按钮 |

---

## 错误处理

- 空 ID 列表：后端返回 400 错误
- 全部无权限：后端正常返回 `deleted_count: 0`，前端提示"无可删除的记录"
- 网络错误：前端 `message.error` 提示

---

## 不在范围内

- 批量编辑
- 删除后的撤销功能
- 分页跨页全选
