# 视觉一体机基础框架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在最新仓库交付四页可联调的基础框架及可复现验收文档。
**Architecture:** Vue SPA 与模块化单体 API，同机 SQLite/本地媒体和独立 Worker；公共契约连接前后端及未来 A/B 模块。
**Tech Stack:** Vue3 / TS / Vite / Naive UI / Pinia / Router / Axios，FastAPI / SQLAlchemy / Alembic / SQLite，FFmpeg、独立 Python Worker。
**Spec:** `docs/superpowers/specs/2026-10-18-foundation-design.md`，完整产品背景见 `docs/MASTER_SPEC.md`。

## Global Constraints

- 用户授权直接实施并在完成后验收；只在新仓库的 codex/foundation 工作区开发。
- 固定七导航，暂不生成模型管理、任务创建、智能体管理页面。
- 正式数据来自 API/持久层；模型和 GPU 未接入如实说明，无运行时 CDN、无云模型回退。
- 不混用旧 Demo 技术栈；时间 UTC、媒体位置毫秒、统一错误和 request_id。
- 每个实现任务先写行为测试，运行失败后再实现；配置及静态视觉无需镜像测试。

## Review Focus

1. 未初始化/未登录不能看到媒体或读写业务接口；写操作必须 CSRF。
2. 文件同名不覆盖、无视频轨/损坏文件拒绝、文件路径不能穿越受控目录。
3. 摄像头凭据不能在 URL/JSON/日志暴露；未知错误不猜测为密码错误。
4. 无 Worker/模型/媒体网关时显示真实不可用，不用假成功填满原型。
5. 刷新、深链接、设置并发编辑及数据库重启不能丢数据或静默覆盖。

## Task 1：后端、持久层及 Worker

Files: `backend/`、`worker/`、`contracts/`、`tests/backend/`。公共契约在 `docs/FOUNDATION_API.md`。
- [x] 写认证/设置/源管理/作业/媒体权限和错误行为测试；确认未实现时失败。
- [x] 实现 SQLAlchemy、Alembic、模块服务、统一 HTTP/WS 错误与独立 Worker。
- [x] 实现真实探测/转码和受保护预览；有缺失组件时返回可行动诊断。
- [x] 运行 pytest；导出 OpenAPI，记录红绿测试与限制。

## Task 2：前端四页面及公共组件

Files: `frontend/`。消费 Task 1 的公共 DTO，不私自改变接口。
- [x] 写路由边界、API 错误、登录与重要表单行为测试，确认失败。
- [x] 实现七项侧栏、四页、初始化登录、状态、真实来源导入和设置持久化。
- [x] 使用统一 loading/empty/error，禁用三模块入口，补响应式与键盘焦点。
- [x] 运行测试、vue-tsc 与 Vite build；说明视觉/接口差异供集成修复。

## Task 3：部署和交接

Files: `deploy/`、根启动脚本、README、`docs/DEVELOPMENT.md`、`docs/ACCEPTANCE.md`。
- [x] 建立独立 .venv 和前端本地安装流程，生产静态资源由同源 API 提供。
- [x] 编写 Windows 安装/运行命令和前后端/Worker 进程管理，端口冲突明确报错。
- [x] 记录 A/B 只读契约、模块边界及主规格后续验收项。

## Task 4：集成验收和独立审查

- [x] 在新数据库上跑完整后端/前端测试及真实短片上传、探测、预览流程。
- [x] 浏览器检查四页、空状态、设置保存刷新、无权限和摄像头失败情况，保存截图。
- [x] 独立审查并修复重要问题；核对交付范围与每项证据。
- [x] 提交已验证的代码和验收文档，交付可访问地址及操作顺序。
