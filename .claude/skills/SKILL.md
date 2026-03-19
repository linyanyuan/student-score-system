## 8. 代码规范

### 8.1 后端（Python/FastAPI/SQLite）
- **编码风格**：严格遵循 [PEP 8](https://www.python.org/dev/peps/pep-0008/) 规范，使用 `black` 或 `autopep8` 自动格式化。
- **命名规则**：
  - 变量/函数：小写字母，单词间用下划线（snake_case）
  - 类名：驼峰式（CamelCase）
  - 常量：全大写加下划线
- **类型注解**：所有函数参数和返回值必须添加类型注解（Type Hints），借助 `mypy` 进行静态检查。
- **文档字符串**：使用 Google 风格或 NumPy 风格的 docstring，说明模块、类、函数的作用、参数和返回值。
- **导入顺序**：标准库 → 第三方库 → 本地模块，各组间空一行。
- **错误处理**：尽量捕获具体异常，避免裸 `except:`；关键业务逻辑需记录日志。
- **测试**：单元测试覆盖率不低于 80%，使用 `pytest` 编写。

### 8.2 前端（React / JavaScript）
- **编码风格**：采用 [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)，使用 `ESLint` 配合 `Prettier` 自动格式化。
- **命名规则**：
  - 组件文件：使用 PascalCase，如 `StudentTable.jsx`
  - 组件内部变量/函数：使用 camelCase
  - CSS 类名：使用 kebab-case（若使用 CSS Modules 则可采用 camelCase）
- **组件设计**：优先使用函数组件 + Hooks，保持组件单一职责；复杂状态使用 Redux Toolkit 或 Context 管理。
- **样式管理**：使用 Ant Design 内置样式，自定义样式采用 CSS Modules 或 Styled Components，避免全局污染。
- **路由**：使用 React Router 6，按模块划分路由懒加载。
- **API 调用**：统一封装 `axios` 实例，配置请求拦截器（添加 token）和响应拦截器（统一错误处理）。
- **注释**：复杂逻辑必须添加注释；组件 Props 使用 PropTypes 或 TypeScript 类型定义。

### 8.3 数据库（SQLite）
- **命名规则**：表名使用复数形式（如 `students`），字段名使用小写加下划线。
- **索引**：为经常查询的字段（如学号、考试ID）添加索引。
- **迁移**：所有表结构变更必须通过 Alembic 迁移脚本管理，严禁手动修改数据库。

### 8.4 Git 提交规范
- **提交信息格式**：`<type>(<scope>): <subject>`，例如 `feat(student): add excel import`
  - type: feat(新功能), fix(修复), docs(文档), style(格式), refactor(重构), test(测试), chore(构建/工具)
- **分支管理**：采用 Git Flow 或 GitHub Flow，`main` 分支为稳定版本，功能分支从 `develop` 检出。
- **代码审查**：所有合并到主分支的代码必须经过 Pull Request 和至少一人 review。

### 8.5 文档与注释
- **API 文档**：FastAPI 自动生成 Swagger 文档（`/docs`），需在代码中添加详细的 Pydantic 模型描述。
- **README**：项目根目录提供 README.md，包含项目简介、快速开始、部署步骤、API 文档链接等。