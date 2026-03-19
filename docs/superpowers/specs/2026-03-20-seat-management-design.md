# 座位管理模块设计文档

**日期**: 2026-03-20
**版本**: 1.0
**状态**: 待审查

## 1. 概述

### 1.1 目标
为学生成绩管理系统添加座位管理功能，允许教师通过拖拽方式灵活管理班级座位表，支持自定义布局、视角切换和导出功能。

### 1.2 核心需求
- 教师可管理自己任教班级的座位表
- 支持拖拽方式分配和调整座位
- 支持灵活的座位布局（每列行数可不同）
- 支持教师/学生视角切换
- 支持导出图片和 Excel
- 支持固定特定学生座位

### 1.3 功能优先级
1. **P0 (必须)**: 拖拽交互、布局调整、保存/加载
2. **P1 (重要)**: 导出图片、导出 Excel
3. **P2 (可选)**: 固定座位、浏览器打印
4. **P3 (未来)**: 男女混排、随机排座

## 2. 系统架构

### 2.1 技术方案
**方案选择**: 前端主导 + 轻量后端存储

**理由**:
- 拖拽交互需要流畅的用户体验，前端处理最优
- 座位布局计算逻辑简单，无需后端参与
- 后端只负责数据持久化，架构清晰

### 2.2 技术栈
- **前端**: React + @dnd-kit/core (拖拽库)
- **后端**: FastAPI + SQLAlchemy
- **导出**: html2canvas (图片) + xlsx (Excel)

### 2.3 核心组件

```
SeatManage (主页面)
├── ClassSelector (班级选择器)
├── ViewToggle (视角切换)
├── LayoutSettings (布局配置面板)
│   ├── ColumnControl (列数控制)
│   └── RowControl (行数控制)
├── StudentList (未分配学生列表)
├── SeatGrid (座位网格)
│   └── SeatCell (单个座位格子)
└── ExportButtons (导出按钮组)
```

## 3. 数据库设计

### 3.1 新增表: seat_arrangements

**注意**: 项目使用 SQLite 数据库，使用 SQLAlchemy ORM 定义模型。

```python
# backend/app/models/seat_arrangement.py
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

from app.database import Base

class SeatArrangement(Base):
    __tablename__ = "seat_arrangements"
    __table_args__ = (
        UniqueConstraint("class_id", name="uq_seat_arrangement_class"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    layout_config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    seat_data: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
```

### 3.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| class_id | INTEGER | 班级ID，唯一约束（每班一个座位表） |
| teacher_id | INTEGER | 创建/修改的教师ID |
| layout_config | TEXT | 布局配置（JSON） |
| seat_data | TEXT | 座位数据（JSON） |
| updated_at | DATETIME | 最后更新时间 |

### 3.3 JSON 数据结构

**layout_config**:
```json
{
  "columns": 5,
  "column_rows": [6, 6, 5, 6, 4],
  "podium_position": "bottom"
}
```

**验证规则**:
- `column_rows` 数组长度必须等于 `columns`
- 每个元素必须 >= 1
- `podium_position` 只能是: "top", "bottom", "left", "right"

**seat_data**:
```json
{
  "0-0": {"student_id": 123},
  "0-1": {"student_id": 124},
  "1-0": null,
  "2-3": {
    "student_id": 125,
    "fixed": true,
    "reason": "视力不好"
  }
}
```

**字段说明**:
- `columns`: 总列数
- `column_rows`: 数组，每列的行数（长度必须等于 columns）
- `podium_position`: 讲台位置 (top/bottom/left/right)
- 座位键格式: `"{列索引}-{行索引}"`，索引从 0 开始
- `fixed`: 是否固定座位（P2功能，初期实现可忽略）
- `reason`: 固定原因备注（P2功能）
- 值为 `null` 表示空座位

## 4. 后端 API 设计

### 4.1 路由前缀
`/api/seats`

### 4.2 API 端点

#### 4.2.1 获取班级座位表
```
GET /api/seats/{class_id}

Response 200:
{
  "id": 1,
  "class_id": 1,
  "layout_config": {...},
  "seat_data": {...},
  "updated_at": "2026-03-20T10:00:00"
}

Response 404:
{
  "detail": "该班级暂无座位表"
}

Response 403:
{
  "detail": "无权限访问该班级座位表"
}
```

**注意**: 所有错误响应统一使用 `detail` 字段，遵循 FastAPI 标准。
{
  "detail": "无权限访问该班级座位表"
}
```

#### 4.2.2 保存/更新座位表
```
POST /api/seats/{class_id}

Request:
{
  "layout_config": {
    "columns": 5,
    "column_rows": [6, 6, 5, 6, 4],
    "podium_position": "bottom"
  },
  "seat_data": {
    "0-0": {"student_id": 123},
    ...
  }
}

Response 200:
{
  "message": "保存成功",
  "updated_at": "2026-03-20T10:00:00"
}

Response 400:
{
  "detail": "数据格式错误"
}

Response 403:
{
  "detail": "无权限管理该班级座位表"
}
```

#### 4.2.3 删除座位表（重置）
```
DELETE /api/seats/{class_id}

Response 200:
{
  "message": "座位表已重置"
}

Response 403:
{
  "detail": "无权限管理该班级座位表"
}
```

### 4.3 权限验证逻辑

**验证方式**: 通过 `teacher_classes` 表验证教师是否任教该班级

```python
def check_seat_permission(user, class_id):
    """
    检查用户是否有权限管理指定班级的座位表

    规则:
    - 管理员: 可以管理所有班级
    - 教师: 只能管理 teacher_classes 表中关联的班级
    - 其他角色: 无权限
    """
    if user.role == "admin":
        return True
    if user.role == "teacher":
        # 检查 teacher_classes 关联
        return db.query(TeacherClass).filter(
            TeacherClass.teacher_id == user.id,
            TeacherClass.class_id == class_id
        ).first() is not None
    return False
```

**使用方式**: 在所有座位表 API 端点中调用此函数验证权限。

## 5. 前端设计

### 5.1 页面布局

```
┌─────────────────────────────────────────────────────────┐
│ 顶部工具栏                                                │
│ [班级选择▼] ┌─────────┬─────────┐ [保存] [导出▼]        │
│            │👨‍🏫 教师  │ 👨‍🎓 学生 │                      │
│            └─────────┴─────────┘                        │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  左侧栏      │         座位网格区域                      │
│  (300px)     │                                          │
│              │    讲台 (学生视角在上)                    │
│ ┌──────────┐│    ┌────┬────┬────┬────┬────┐           │
│ │布局设置  ││    │张三│李四│王五│赵六│    │           │
│ ├──────────┤│    ├────┼────┼────┼────┼────┤           │
│ │列数: 5   ││    │孙七│周八│吴九│郑十│钱一│           │
│ │默认行数:6││    ├────┼────┼────┼────┼────┤           │
│ │          ││    │陈二│    │刘三│    │    │           │
│ │单独调整: ││    └────┴────┴────┴────┴────┘           │
│ │第1列: 6  ││                                          │
│ │第2列: 6  ││    讲台 (教师视角在下)                    │
│ │第3列: 5  ││                                          │
│ │第4列: 6  ││                                          │
│ │第5列: 4  ││                                          │
│ │          ││                                          │
│ │[应用]    ││                                          │
│ ├──────────┤│                                          │
│ │未分配学生││                                          │
│ ├──────────┤│                                          │
│ │[王小明]  ││                                          │
│ │[李小红]  ││                                          │
│ │[张小刚]  ││                                          │
│ └──────────┘│                                          │
└──────────────┴──────────────────────────────────────────┘
```

### 5.2 拖拽交互

#### 5.2.1 拖拽源 (Draggable)
1. 左侧未分配学生列表中的学生
2. 座位网格中已分配的学生

#### 5.2.2 放置目标 (Droppable)
1. 座位网格中的每个座位格子
2. 左侧未分配学生列表区域

#### 5.2.3 拖拽场景

**场景 1: 从列表拖到座位**
```
操作: 拖拽 [王小明] → 座位(2,3)
结果:
- 王小明从未分配列表移除
- 座位(2,3)显示王小明
- 如果座位(2,3)原有学生，该学生返回列表
```

**场景 2: 座位间交换**
```
操作: 拖拽 座位(1,2)的张三 → 座位(3,4)的李四
结果:
- 张三移动到座位(3,4)
- 李四移动到座位(1,2)
- 两个学生位置互换

操作: 拖拽 座位(1,2)的张三 → 空座位(3,4)
结果:
- 张三移动到座位(3,4)
- 座位(1,2)变为空座位
```

**场景 3: 从座位拖回列表**
```
操作: 拖拽 座位(2,3)的王小明 → 未分配列表
结果:
- 王小明从座位(2,3)移除
- 王小明添加到未分配列表
- 座位(2,3)变为空座位
```

#### 5.2.4 视觉反馈
- **拖拽中**: 显示半透明预览，原位置保留占位符
- **可放置**: 目标区域显示绿色边框
- **不可放置**: 显示禁止图标，鼠标变为 `not-allowed`
- **空座位**: 灰色虚线边框，显示"空"字样

### 5.3 视角切换

#### 5.3.1 UI 组件
分段控制器（Segmented Control）:
```jsx
<div className="view-toggle">
  <button className={view === 'teacher' ? 'active' : ''}>
    👨‍🏫 教师
  </button>
  <button className={view === 'student' ? 'active' : ''}>
    👨‍🎓 学生
  </button>
</div>
```

#### 5.3.2 视角差异
- **教师视角**: 讲台在下方（教师看学生的角度）
- **学生视角**: 讲台在上方（学生看黑板的角度）
- 切换视角时，座位网格垂直翻转
- 座位数据不变，仅改变渲染顺序

#### 5.3.3 实现方式
```jsx
const renderSeats = () => {
  const rows = [...Array(maxRows)];
  if (view === 'student') {
    rows.reverse(); // 学生视角翻转
  }
  return rows.map((_, rowIndex) => renderRow(rowIndex));
};
```

### 5.4 布局调整

#### 5.4.1 调整规则

**增加列数**:
- 在右侧添加新列
- 新列使用默认行数
- 所有座位为空

**减少列数**:
- 删除最右侧的列
- 该列的学生返回未分配列表
- 弹出确认: "第5列有3名学生，删除后将返回未分配列表，确认吗？"

**增加某列行数**:
- 在该列底部添加空座位
- 无需确认

**减少某列行数**:
- 删除该列底部的座位
- 如果有学生，返回未分配列表
- 弹出确认: "第3列第6排有学生，删除后将返回未分配列表，确认吗？"

#### 5.4.2 边界限制
- 最少 1 列
- 每列最少 1 行
- 最多 10 列（避免显示问题）
- 每列最多 15 行

### 5.5 导出功能

#### 5.5.1 导出图片 (P1 - 最高优先级)

**实现方案**: 使用 html2canvas

```jsx
import html2canvas from 'html2canvas';

const exportImage = async () => {
  const element = document.getElementById('seat-grid');
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // 高清
    useCORS: true, // 处理跨域图片（如果未来添加学生头像）
    allowTaint: false,
  });
  const link = document.createElement('a');
  link.download = `${className}-座位表.png`;
  link.href = canvas.toDataURL();
  link.click();
};
```

**注意**:
- 如果未来添加学生头像功能，需要确保图片支持 CORS
- 或者使用代理服务器处理图片
- 初期实现只有文字，无此问题

**导出内容**:
- 班级名称
- 更新时间
- 座位网格（使用教师视角）
- 讲台标识
- 列号标注

#### 5.5.2 导出 Excel (P1)

**实现方案**: 使用 xlsx

```jsx
import * as XLSX from 'xlsx';

const exportExcel = () => {
  const data = [];
  // 标题行
  data.push([`${className} 座位表`]);
  data.push([`更新时间: ${updateTime}`]);
  data.push([]);

  // 座位数据
  for (let row = 0; row < maxRows; row++) {
    const rowData = [];
    for (let col = 0; col < columns; col++) {
      const student = seatData[`${col}-${row}`];
      rowData.push(student ? student.name : '');
    }
    data.push(rowData);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '座位表');
  XLSX.writeFile(wb, `${className}-座位表.xlsx`);
};
```

#### 5.5.3 浏览器打印 (P2)

**实现方案**: CSS @media print

```css
@media print {
  .toolbar, .sidebar, .export-buttons {
    display: none;
  }

  .seat-grid {
    page-break-inside: avoid;
  }

  .seat-cell {
    border: 1px solid #000;
    font-size: 14pt;
  }
}
```

### 5.6 固定座位功能 (P2)

#### 5.6.1 UI 交互
- 右键点击已分配座位 → 弹出菜单
- 菜单选项: [📌 固定座位] [备注] [🔓 取消固定]
- 固定后座位显示图钉图标 📌

#### 5.6.2 视觉样式
```css
.seat-cell.fixed {
  border: 2px solid #f59e0b;
  position: relative;
}

.seat-cell.fixed::after {
  content: '📌';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 12px;
}
```

#### 5.6.3 拖拽限制
- 固定座位可以被拖拽到其他位置（保持固定状态）
- 其他学生不能拖拽到固定座位（显示禁止图标）
- 布局调整时优先保留固定座位

## 6. 状态管理

### 6.1 核心状态

```jsx
const [selectedClass, setSelectedClass] = useState(null);
const [view, setView] = useState('teacher'); // 'teacher' | 'student'
const [layoutConfig, setLayoutConfig] = useState({
  columns: 5,
  column_rows: [6, 6, 6, 6, 6],
  podium_position: 'bottom'
});
const [seatData, setSeatData] = useState({});
const [unassignedStudents, setUnassignedStudents] = useState([]);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
```

**状态管理方案**: 使用 React useState
- 对于座位管理这种相对独立的功能，useState 足够
- 拖拽状态由 @dnd-kit 内部管理
- 如果未来状态逻辑变复杂，可以考虑 useReducer

### 6.2 数据流

```
1. 用户选择班级
   ↓
2. 加载班级学生列表 (GET /api/students?class_id={id})
   ↓
3. 加载座位表配置 (GET /api/seats/{class_id})
   ↓
4. 计算未分配学生 (学生列表 - 已分配学生)
   ↓
5. 渲染座位网格
   ↓
6. 用户拖拽调整
   ↓
7. 更新本地状态 (setSeatData)
   ↓
8. 标记未保存 (setHasUnsavedChanges)
   ↓
9. 用户点击保存
   ↓
10. 提交到后端 (POST /api/seats/{class_id})
```

## 7. 错误处理

### 7.1 网络错误
```jsx
try {
  await saveSeatArrangement();
  message.success('保存成功');
} catch (error) {
  message.error('保存失败，请重试');
  // 保留本地更改
}
```

### 7.2 权限错误
```jsx
if (response.status === 403) {
  message.error('无权限管理该班级座位表');
  setReadOnly(true); // 切换为只读模式
}
```

### 7.3 边界情况

**班级无学生**:
```jsx
if (students.length === 0) {
  return (
    <Empty description="该班级暂无学生，请先添加学生" />
  );
}
```

**切换班级前检查**:
```jsx
const handleClassChange = (newClassId) => {
  if (hasUnsavedChanges) {
    Modal.confirm({
      title: '有未保存的更改',
      content: '切换班级将丢失未保存的更改，是否继续？',
      onOk: () => loadClass(newClassId),
    });
  } else {
    loadClass(newClassId);
  }
};
```

**布局调整影响学生**:
```jsx
const handleReduceColumn = (colIndex) => {
  const affectedStudents = getStudentsInColumn(colIndex);
  if (affectedStudents.length > 0) {
    Modal.confirm({
      title: '确认删除',
      content: `第${colIndex + 1}列有${affectedStudents.length}名学生，删除后将返回未分配列表，确认吗？`,
      onOk: () => removeColumn(colIndex),
    });
  } else {
    removeColumn(colIndex);
  }
};
```

## 8. 性能优化

### 8.1 虚拟滚动
当学生数量 > 50 时，未分配学生列表使用虚拟滚动:
```jsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={unassignedStudents.length}
  itemSize={50}
>
  {({ index, style }) => (
    <StudentItem student={unassignedStudents[index]} style={style} />
  )}
</FixedSizeList>
```

### 8.2 拖拽优化
使用 useMemo 缓存座位网格渲染:
```jsx
const seatGrid = useMemo(() => {
  return renderSeatGrid(layoutConfig, seatData);
}, [layoutConfig, seatData, view]);
```

### 8.3 防抖保存
自动保存使用防抖:
```jsx
const debouncedSave = useMemo(
  () => debounce(saveSeatArrangement, 2000),
  []
);

useEffect(() => {
  if (hasUnsavedChanges) {
    debouncedSave();
  }
}, [seatData]);
```

## 9. 实现路线图

### Phase 1: 核心功能 (P0)
- [ ] 数据库表和 API 端点
- [ ] 基础页面布局
- [ ] 拖拽交互实现
- [ ] 布局调整功能
- [ ] 保存/加载功能
- [ ] 视角切换

### Phase 2: 导出功能 (P1)
- [ ] 导出图片
- [ ] 导出 Excel
- [ ] 浏览器打印

### Phase 3: 增强功能 (P2)
- [ ] 固定座位
- [ ] 右键菜单
- [ ] 座位备注

### Phase 4: 未来功能 (P3)
- [ ] 随机排座
- [ ] 男女混排
- [ ] 历史记录

## 10. 测试计划

### 10.1 单元测试
- 权限验证逻辑
- 座位数据转换函数
- 布局调整算法

### 10.2 集成测试
- API 端点测试
- 拖拽交互测试
- 导出功能测试

### 10.3 用户测试场景
1. 创建新座位表
2. 拖拽分配所有学生
3. 调整布局（增减列/行）
4. 切换视角
5. 导出图片和 Excel
6. 保存并重新加载
7. 切换班级

## 11. 依赖项

### 11.1 前端新增依赖
```json
{
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^7.0.0",
  "html2canvas": "^1.4.1",
  "xlsx": "^0.18.5"
}
```

### 11.2 后端新增依赖
无新增依赖（使用现有 FastAPI + SQLAlchemy）

## 12. 安全考虑

### 12.1 权限验证
- 每个 API 请求都验证用户权限
- 教师只能访问自己任教的班级
- 管理员可以访问所有班级

### 12.2 数据验证
- 验证 class_id 存在
- 验证 student_id 属于该班级
- 验证 JSON 格式正确
- 防止 SQL 注入（使用 ORM）

### 12.3 XSS 防护
- 学生姓名使用 React 自动转义
- 不使用 dangerouslySetInnerHTML

## 13. 可访问性

### 13.1 键盘导航
- Tab 键在座位间导航
- Enter 键选中/取消选中
- 方向键移动焦点

### 13.2 屏幕阅读器
- 座位添加 aria-label: "第1列第2排，学生：张三"
- 空座位: "第1列第2排，空座位"

### 13.3 颜色对比
- 确保文字和背景对比度 ≥ 4.5:1
- 不仅依赖颜色传达信息（使用图标）

## 14. 附录

### 14.1 参考资料
- 参考网站: https://classtool.cn/seat-generator/
- @dnd-kit 文档: https://docs.dndkit.com/
- html2canvas 文档: https://html2canvas.hertzen.com/

### 14.2 术语表
- **座位表**: 班级学生的座位分配方案
- **布局**: 座位的行列配置
- **视角**: 教师视角或学生视角
- **固定座位**: 不参与随机排座的特殊座位

---

**文档结束**
