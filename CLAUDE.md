# Claude 协作规则

## 严禁覆盖本地文件

**在执行任何会覆盖本地文件的操作之前，必须先询问用户确认。** 包括但不限于：

- `git checkout HEAD -- <file>` 覆盖工作区文件
- `git checkout <branch> -- <file>` 从其他分支拉取文件
- `git pull` / `git fetch` + merge/reset 覆盖本地改动
- `git stash pop` / `git stash drop` 丢弃 stash
- `git reset --hard`
- `git clean -f`
- 用 `cp` / `Write` 工具直接覆盖用户正在编辑的文件

**原因：** 用户可能有未提交的本地修改（未 commit、未 push），这些改动一旦被覆盖将无法恢复，造成代码丢失。

**正确做法：**
1. 先用 `git status` / `git diff` 检查本地是否有未提交修改
2. 如有未提交修改，**必须先询问用户**再决定是否继续
3. 得到用户明确确认后才能执行覆盖操作
