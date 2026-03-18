# 成绩管理模块Bug修复设计

日期: 2026-03-19

## 概述

修复成绩管理模块的3个问题：
1. 成绩列表删除按钮报错
2. 学生成绩分析的学生搜索框没数据
3. 班级成绩分析的班级排名图表布局优化

## 问题1：删除按钮报错

### 现状
- 前端调用 `deleteScoreByStudent(examId, studentId)`
- 后端接口 `DELETE /api/scores/by-student?exam_id=X&student_id=Y`
- 点击删除后报错，后端接口异常

### 调试步骤
1. 打开浏览器开发者工具 Network 面板
2. 点击删除按钮，查看请求响应
3. 记录具体错误码和错误信息（500/403/404等）
4. 查看后端日志确定具体异常

### 可能的修复方案
根据错误类型：
- **500错误**：检查数据库事务、recalculate_ranks函数
- **403错误**：检查权限校验逻辑
- **404错误**：检查学生/考试是否存在

### 涉及文件
- `backend/app/routers/scores.py` - `delete_scores_by_student` 函数

## 问题2：学生搜索框没数据 + 显示格式

### 现状
- `StudentAnalysis.jsx` 调用 `getStudents({ page: 1, page_size: 9999 })`
- 管理员登录时应能看到所有学生，但搜索框无数据
- 当前显示格式：`学号 - 姓名`

### 调试步骤
1. 打开浏览器开发者工具 Network 面板
2. 切换到学生成绩分析tab，查看 `/api/students` 请求响应
3. 检查响应数据是否包含学生列表
4. 检查 Console 是否有错误

### 修复方案
1. 如果API返回空数据：检查数据库是否有学生记录
2. 如果API返回正常但前端无数据：检查数据解析逻辑
3. 修改显示格式为只显示姓名

### 代码修改

```jsx
// StudentAnalysis.jsx 第194-197行
const studentOptions = students.map((s) => ({
  value: s.id,
  label: s.name,  // 只显示姓名（原为 `${s.student_no} - ${s.name}`）
}))

// 同时修改 filterOption 以支持按姓名搜索
filterOption={(input, option) =>
  option.label.toLowerCase().includes(input.toLowerCase())
}
```

### 涉及文件
- `frontend/src/pages/StudentAnalysis.jsx`

## 问题3：班级排名图表布局优化

### 现状
- 单个图表，不选科目显示总分排名，选科目显示科目排名
- 用户需要切换查看

### 修复方案
左右并排两个图表（替换现有单个图表）：

```
┌─────────────────────────────┬─────────────────────────────┐
│     科目排名（可多选）        │   班级平均分排名（排行榜）    │
│  [x]语文 [x]数学 [ ]英语...  │                             │
│                             │  班级A ████████████ 285.5   │
│   ┌───┐ ┌───┐              │  班级B ██████████   270.2   │
│   │   │ │   │ ...          │  班级C █████████    265.8   │
│   │ A │ │ B │              │  班级D ████████     258.3   │
│   └───┘ └───┘              │                             │
└─────────────────────────────┴─────────────────────────────┘
```

### 左侧：科目排名柱状图
- 勾选科目后显示
- X轴：科目名称
- 柱状条：不同班级（分组柱状图）
- 不选科目时显示提示"请选择科目查看排名"

### 右侧：班级平均分排名横向条形图
- 始终显示（不依赖科目选择）
- 显示本次考试所有班级的学生总分平均分排名
- Y轴：班级名称（按平均分从高到低排序）
- X轴：平均分
- 条形末端显示具体分数
- 排行榜样式

### 代码修改

```jsx
// ClassAnalysis.jsx

// 1. 添加 Bar 组件导入
import { Column, Bar } from '@ant-design/charts'

// 2. 新增总分排名数据状态（与现有 classesRankData 分开）
const [totalRankData, setTotalRankData] = useState([])

// 3. 新增 useEffect 获取总分排名数据（独立请求，不受科目选择影响）
useEffect(() => {
  if (!examId) {
    setTotalRankData([])
    return
  }
  getClassesRank(examId, undefined).then((res) => {
    // 按平均分从高到低排序
    const data = (res.data || []).sort((a, b) => b.avg_score - a.avg_score)
    setTotalRankData(data)
  })
}, [examId])

// 4. 横向条形图配置
const totalRankConfig = {
  data: totalRankData,
  xField: 'avg_score',
  yField: 'class_name',
  seriesField: 'class_name',
  legend: false,
  label: {
    position: 'right',
    formatter: (datum) => datum.avg_score?.toFixed(1),
  },
  yAxis: { label: { autoRotate: false } },
  tooltip: {
    formatter: (datum) => ({
      name: '班级平均分',
      value: datum.avg_score?.toFixed(1),
    }),
  },
  color: '#1890ff',
}

// 5. 修改布局为左右两列（替换现有的单个 Card）
<Row gutter={16} style={{ marginBottom: 16 }}>
  <Col span={12}>
    <Card title="科目排名" size="small">
      <div style={{ marginBottom: 12 }}>
        <Checkbox.Group
          value={selectedSubjectIds}
          onChange={setSelectedSubjectIds}
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>
      {selectedSubjectIds.length > 0 ? (
        <Column {...rankConfig} height={260} />
      ) : (
        <Empty description="请选择科目查看排名" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  </Col>
  <Col span={12}>
    <Card title="班级平均分排名" size="small">
      {totalRankData.length > 0 ? (
        <Bar {...totalRankConfig} height={260} />
      ) : (
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  </Col>
</Row>
```

### 涉及文件
- `frontend/src/pages/ClassAnalysis.jsx`

## 实施顺序

1. 问题1：调试删除接口错误，根据具体错误修复
2. 问题2：修复学生搜索框显示格式
3. 问题3：重构班级排名图表布局

## 验证标准

### 问题1
- 点击删除按钮后弹出确认框
- 确认后成功删除，显示"删除成功"
- 列表刷新，被删除的学生成绩不再显示

### 问题2
- 管理员登录后，学生搜索框下拉显示所有学生姓名
- 输入姓名可以搜索过滤
- 选择学生后正确加载分析数据

### 问题3
- 页面显示左右两个图表
- 左侧：选择科目后显示科目排名柱状图
- 右侧：始终显示班级平均分排名横向条形图
- 右侧按分数从高到低排序，显示排行榜效果
