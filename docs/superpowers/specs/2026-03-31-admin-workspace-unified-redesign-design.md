# 管理工作台统一重构设计说明

## 1. 背景

当前系统中的排课管理页 [`frontend/src/pages/ScheduleManage.jsx`](d:/project/student-score-system/frontend/src/pages/ScheduleManage.jsx) 已经形成较完整的后台工作台风格，但首页、班级管理、科目管理、考试管理仍然保留较早期的页面形态：

- [`frontend/src/pages/Home.jsx`](d:/project/student-score-system/frontend/src/pages/Home.jsx) 信息较多，但模块层级与页面容器风格尚未完全统一
- [`frontend/src/pages/ClassManage.jsx`](d:/project/student-score-system/frontend/src/pages/ClassManage.jsx) 仍是基础 CRUD 页面
- [`frontend/src/pages/SubjectManage.jsx`](d:/project/student-score-system/frontend/src/pages/SubjectManage.jsx) 仍是基础 CRUD 页面
- [`frontend/src/pages/ExamManage.jsx`](d:/project/student-score-system/frontend/src/pages/ExamManage.jsx) 仍是基础 CRUD 页面
- [`frontend/src/components/MainLayout.jsx`](d:/project/student-score-system/frontend/src/components/MainLayout.jsx) 仍是较朴素的全局容器，无法完整承接新版页面风格

本次工作目标是在不改动后端接口与核心业务规则的前提下，基于排课管理页面已建立的视觉语言，统一重构首页、班级管理、科目管理、考试管理，并同步优化全局布局容器，使它们表现为同一套后台工作台产品。

## 2. 目标与非目标

### 2.1 目标

- 统一首页、班级管理、科目管理、考试管理与排课管理页的视觉体系
- 同步升级 [`frontend/src/components/MainLayout.jsx`](d:/project/student-score-system/frontend/src/components/MainLayout.jsx)，让页面壳体与内容风格一致
- 在不改变业务能力的前提下，优化页面信息架构与交互层级
- 为列表型管理页补充摘要区、筛选区、空状态与更清晰的主次操作关系
- 保持现有接口、角色权限与主要增删改查流程稳定可用

### 2.2 非目标

- 不新增后端接口
- 不修改现有接口协议与字段语义
- 不改变角色权限规则与路由结构
- 不将页面重构为完全不同的业务流，如向导式复杂流程或多页面拆分
- 不引入与现有系统气质冲突的重装饰风格，如深色科技风、重拟物或高强度动效

## 3. 现状确认

### 3.1 页面结构现状

- [`frontend/src/components/MainLayout.jsx`](d:/project/student-score-system/frontend/src/components/MainLayout.jsx) 采用标准 `Layout + Sider + Header + Content`，但内容区仍是单层白底容器
- [`frontend/src/pages/ClassManage.jsx`](d:/project/student-score-system/frontend/src/pages/ClassManage.jsx) 仅包含新增按钮、表格和弹窗
- [`frontend/src/pages/SubjectManage.jsx`](d:/project/student-score-system/frontend/src/pages/SubjectManage.jsx) 仅包含新增按钮、表格和弹窗
- [`frontend/src/pages/ExamManage.jsx`](d:/project/student-score-system/frontend/src/pages/ExamManage.jsx) 仅包含新增按钮、表格和弹窗
- [`frontend/src/pages/Home.jsx`](d:/project/student-score-system/frontend/src/pages/Home.jsx) 已经有课表展示与角色差异化，但整体模块包装与上层页面框架仍可进一步统一

### 3.2 可复用设计母版

[`frontend/src/pages/ScheduleManage.jsx`](d:/project/student-score-system/frontend/src/pages/ScheduleManage.jsx) 已经形成以下可复用语言：

- 浅色渐变页面背景
- 深浅对比明确的顶部摘要区
- 轻玻璃感卡片与较大圆角
- 明确的标题层级与说明文案
- 高信息密度但不粗糙的内容卡布局
- 稳定的状态反馈与空状态处理

本次重构将以该页面的语言为母版，而不是另起一套全新设计系统。

## 4. UI/UX 设计结论

本次方案已结合 `ui-ux-pro-max` 检索结果进行方向确认，查询重点为：

- `education school admin dashboard scheduling premium light data-dense`
- `dashboard table form management empty state accessibility`
- `education admin light premium`
- `education dashboard blue amber light`
- `professional dashboard readable sans`

综合工具输出与项目现状，最终采用以下设计结论：

- 选择“浅色、专业、高信息密度的后台工作台”路线
- 采用蓝色为主、琥珀色为强调的配色策略
- 保持后台工具的稳定性与熟悉感，不追求过强装饰性
- 对表格、筛选、摘要、空状态进行系统化统一
- 强化可访问性，尤其是表单标签、模态焦点与显式状态反馈

不采用的方向包括：

- 深色科技风
- 强拟物与复杂纹理
- 过度玻璃化导致对比度下降的视觉方案
- 仅“换皮”而不优化信息架构的低收益改法

## 5. 全局设计系统

### 5.1 页面壳体

- 外层使用浅蓝灰渐变背景，延续排课管理页的背景气质
- 页面主体不再裸露放置在纯白容器中，而是置于统一的内容工作台容器中
- 页面内容保持较宽但有明确边界的最大宽度
- 页面节奏统一为：顶部摘要区 -> 指标/筛选区 -> 主内容卡

### 5.2 色彩

- 主色：专业蓝，用于主按钮、重点标题、小型强调标签
- 强调色：琥珀色，用于关键统计、提醒与少量聚焦操作
- 成功态：绿色
- 提醒态：橙色
- 风险态：红色
- 背景：浅蓝灰与白色层次叠加

### 5.3 卡片与容器

- 内容卡统一采用较大圆角
- 卡片边框使用低对比细边框，阴影保持柔和
- 卡片标题区统一采用 `eyebrow + 主标题 + 辅助说明` 的层级
- 列表、图表、课表、统计块均放入内容卡内部，而非直接散落在页面上

### 5.4 表格与筛选

- 列表型页面统一使用“筛选条 + 表格卡”的结构
- 表格保留高信息密度，但行 hover、列头风格、空状态文案统一
- 筛选条采用同一组控件尺寸和布局规则，保证跨页面一致性
- 搜索、筛选、重置操作在视觉上与主按钮区分明显

### 5.5 按钮与操作层级

- 页面级主操作固定在页头右侧
- 筛选条内只放局部操作，不抢主操作优先级
- 行级操作维持编辑/删除的轻量操作样式
- 删除类操作继续保留二次确认

### 5.6 状态反馈

- 加载态：使用轻量 `Spin` 或卡片骨架感占位，不做整页闪烁
- 空状态：统一展示解释与下一步建议
- 错误态：统一在页面或卡片级以 `Alert/message` 给出明确说明
- 成功态：沿用现有提示机制，但提示语气统一

### 5.7 可访问性

结合 `ui-ux-pro-max` React 指南，本次至少满足：

- 所有表单控件使用明确标签，不依赖 placeholder 传意
- 模态打开后焦点行为稳定，关闭后返回触发位置
- 可点击元素具备清晰 hover/focus 状态
- 颜色不作为唯一状态表达方式

## 6. 全局布局改造

改造对象为 [`frontend/src/components/MainLayout.jsx`](d:/project/student-score-system/frontend/src/components/MainLayout.jsx)。

### 6.1 侧边栏

- 保留当前导航结构、角色权限与菜单项顺序
- 升级品牌头区域，使其与新版页面视觉语言一致
- 优化选中态、悬停态和折叠态细节
- 保持现有易用性，不做结构性重排

### 6.2 顶部栏

- 保留菜单折叠按钮、用户信息与退出操作
- 从纯功能头部升级为更完整的全局工作台头部
- 与页面内容之间建立更自然的视觉衔接，避免“深色侧边栏 + 白色内容块”的割裂

### 6.3 内容容器

- 由单层白底块改为“背景层 + 页面壳 + 内容模块”
- 为首页和管理页预留一致的顶部摘要空间
- 在桌面与移动端下统一内容边距与留白节奏

## 7. 页面信息架构

### 7.1 首页

重构对象为 [`frontend/src/pages/Home.jsx`](d:/project/student-score-system/frontend/src/pages/Home.jsx)。

#### 页面定位

首页从“模块拼接页”调整为“角色感知的工作台首页”。

#### 结构

- 顶部欢迎区：显示当前用户角色、工作提示与一句说明
- 摘要卡区：展示角色相关的 3 至 4 个核心指标
- 主工作区：展示课表核心内容
- 辅助区：展示备忘、快捷入口或补充信息

#### 学校管理员视角

- 首页指标偏向基础配置与排课状态
- 提供前往班级管理、科目管理、考试管理、排课管理的快捷入口卡
- 快捷入口视觉语言参考排课管理页的概览跳转卡

#### 教师/学生视角

- 首页更强调我的课表、今日信息、待办或备忘
- 不引入无权限或低相关度的管理入口

#### 设计重点

- 让首页成为“进入系统后的第一工作台”，而不是单纯的信息拼盘
- 保持课表能力为主角，但让辅助模块有更清晰层级

### 7.2 班级管理

重构对象为 [`frontend/src/pages/ClassManage.jsx`](d:/project/student-score-system/frontend/src/pages/ClassManage.jsx)。

#### 页面定位

页面定位为班级基础信息工作台，而非单纯 CRUD 列表。

#### 结构

- 顶部摘要区：说明页面用途，并承载主操作按钮
- 指标卡区：班级总数、年级覆盖数、当前筛选结果数
- 筛选条：按年级筛选、按名称搜索
- 主表格卡：展示班级列表与行内操作
- 编辑弹窗：处理新建与编辑

#### 交互规则

- “新建班级”为页面主操作
- 编辑与删除保留在行内
- 空状态引导用户先创建班级
- 过滤仅影响前端展示，不改变接口契约

### 7.3 科目管理

重构对象为 [`frontend/src/pages/SubjectManage.jsx`](d:/project/student-score-system/frontend/src/pages/SubjectManage.jsx)。

#### 页面定位

页面定位为学科配置工作台，强调“科目定义 + 适用年级范围”。

#### 结构

- 顶部摘要区：说明科目配置作用，并承载主操作按钮
- 指标卡区：科目总数、已覆盖年级数、未分配适用年级的科目数
- 筛选条：按名称/代码搜索、按适用年级筛选
- 主表格卡：展示科目信息
- 编辑弹窗：处理科目名称、代码、适用年级编辑

#### 交互规则

- 适用年级在表格中继续保留标签化展示，但风格统一
- 未设置适用年级时给出温和提示，而不是仅显示空值
- 表单字段层级明确，避免现有弹窗过于平铺

### 7.4 考试管理

重构对象为 [`frontend/src/pages/ExamManage.jsx`](d:/project/student-score-system/frontend/src/pages/ExamManage.jsx)。

#### 页面定位

页面定位为考试安排工作台，重点突出考试时间与覆盖范围。

#### 结构

- 顶部摘要区：说明页面用途，并承载主操作按钮
- 指标卡区：考试总数、最近一场考试、覆盖年级数
- 筛选条：按名称搜索、按参与年级过滤、按日期排序
- 主表格卡：展示考试名称、日期、参与年级、描述与行内操作
- 编辑弹窗：处理考试名称、日期、年级、描述

#### 交互规则

- “新建考试”为页面主操作
- 日期字段在视觉上具备更高权重
- 没有考试数据时提供明确引导，而不是只显示空表格

## 8. 数据与实现边界

### 8.1 数据边界

- 首页、班级管理、科目管理、考试管理均继续使用现有 API
- 新增的摘要数字、筛选结果数、空状态提示均从已有数据推导
- 不新增后端聚合接口

### 8.2 实现边界

- 允许提取页面级公用样式与轻量 UI 片段
- 允许适度整理首页内部结构，以适应统一工作台风格
- 不进行与本次目标无关的大规模组件库抽象

## 9. 测试策略

### 9.1 功能回归

- 班级管理：新增、编辑、删除可正常工作
- 科目管理：新增、编辑、删除可正常工作，年级字段转换逻辑不回归
- 考试管理：新增、编辑、删除可正常工作，日期与年级转换逻辑不回归
- 首页：不同角色仍显示正确内容边界，不出现权限越界

### 9.2 交互验证

- 筛选与搜索只影响前端展示结果
- 空状态在无数据场景下稳定显示
- 模态表单打开、关闭、提交行为正常
- 布局在桌面和窄屏下均不出现明显断裂

### 9.3 结构与内容测试

- 对结构变化较大的首页优先补充 smoke/regression 测试
- 对班级、科目、考试页面至少验证关键文案与主要交互仍可触达

## 10. 实施顺序建议

建议按以下顺序实施：

1. 先升级 [`frontend/src/components/MainLayout.jsx`](d:/project/student-score-system/frontend/src/components/MainLayout.jsx) 与全局页面容器样式
2. 重构 [`frontend/src/pages/Home.jsx`](d:/project/student-score-system/frontend/src/pages/Home.jsx)，确立统一工作台首页风格
3. 重构 [`frontend/src/pages/ClassManage.jsx`](d:/project/student-score-system/frontend/src/pages/ClassManage.jsx)
4. 重构 [`frontend/src/pages/SubjectManage.jsx`](d:/project/student-score-system/frontend/src/pages/SubjectManage.jsx)
5. 重构 [`frontend/src/pages/ExamManage.jsx`](d:/project/student-score-system/frontend/src/pages/ExamManage.jsx)
6. 最后统一调整细节样式、空状态与回归测试

## 11. 结论

本次方案的核心不是为四个页面单独“美化”，而是把它们统一纳入排课管理页已经建立的后台工作台体系。这样既能提升整体观感，又能改善操作层级与信息组织，同时避免偏离当前项目的技术与产品边界。
