# 三人协作指南

## 成员与任务

负责人维护仓库设置、任务优先级和版本计划。每项任务指定一位实现负责人及另一位审查人，三人可以轮换承担开发、测试和审查。

新增功能使用功能需求模板创建 Issue；发现问题使用缺陷模板。Issue 中写清目标、验收条件、负责人和关联资料，避免两个人同时修改同一任务而不沟通。

## 日常开发流程

开始新任务前更新主分支，再创建任务分支。以下命令中的编号和分支名需要替换为自己的任务：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/12-device-settings
```

小步提交，每次围绕一个明确修改：

```bash
git add path/to/changed-file
git commit -m "feat: add device settings"
git push -u origin feat/12-device-settings
```

在 GitHub 创建 Pull Request，说明问题、实现效果和验证方式，用 `Closes #12` 关联任务。建议至少一位其他成员审查，确认验证结果后合并；此为协作约定，目前没有配置强制分支保护。

合并后更新本机主分支，下一项任务使用新分支：

```bash
git switch main
git pull --ff-only origin main
```

## 分支与提交

- `main`：保存已审查、可共享的版本。
- `feat/<任务号>-<说明>`：新增功能。
- `fix/<任务号>-<说明>`：修复问题。
- `docs/<任务号>-<说明>`：文档修改。

提交信息可用中文，例如 `fix: 修复设备断线后的状态显示`。不要对团队共享分支使用强制推送；冲突解决后重新验证，并让审查人了解修改。

## 验证与资料

涉及逻辑变更时说明测试结果；涉及界面时附必要截图。依赖和启动方式改变时，同步更新 README。API Key 使用环境变量或系统凭据管理器，不提交真实密钥、客户视频和本机运行记录。

技术栈为 Vue 3 / TypeScript 与 FastAPI / SQLite，安装、启动及固定测试命令见 README。模块边界与另外两位成员的接入约定见 `docs/DEVELOPMENT.md`，修改公共接口时同步更新 `contracts/` 和前端生成类型。当前尚未配置远程 CI，提交前需执行本地验证并在 PR 中记录结果。
