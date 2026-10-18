# SDD ledger — plan: docs/superpowers/plans/2026-10-18-foundation.md

Base: a54ae92。工作区 `.worktrees/foundation`，分支 `codex/foundation`。

用户授权：直接完成后交付验收文档，无需再次请求逐步批准。

## Preflight

| 任务/交接 | 检查 | 结果 |
| --- | --- | --- |
| Task 1 自检 | 后端/Worker/数据库由同一任务拥有，避免重复基础设施 | 一致 |
| Task 2 自检 | 只写 frontend，不写后端；四页加公共壳 | 一致 |
| Task 3 自检 | 根脚本/deploy/docs 由集成人负责 | 一致 |
| Task 1 → 2 | 共用 docs/FOUNDATION_API.md 的字段和端点 | 已冻结初版，变更须通知 |
| Task 1 → 3 | Python 入口 app.main:create_app / worker.supervisor，依赖 backend/requirements.txt | 由 Task 1 交付并核对 |
| Task 2 → 3 | frontend npm test/build，dist 静态资源 | 由 Task 2 交付并核对 |
| Task 4 | 独立审查、浏览器和真实媒体测试 | 已完成，见下方证据 |

Ruling: 完整主规格为最终产品依据，本次基础框架只实现用户委托的四页与公共联调层；任务/智能体/模型 UI 仍不生成 — 遵循用户本轮明确范围 — 后续仍需完成其 FR/AC，不把本次完成宣称为完整产品验收。

Ruling: 原生 worktree 工具返回 invalid reference: main，无法定位本次新仓库；使用本仓库内已忽略目录创建 Git worktree — 避免误改旧 Demo — 后续保留运行中工作区。

## 进度

- Task 1: complete — backend/worker/契约，29 项后端测试通过。
- Task 2: complete — 四页与公共层，21 项前端测试及构建通过。
- Task 3: complete — 安装器全流程、启动/退出/端口冲突、3 项部署测试通过。
- Task 4: complete — 21 项真实 HTTP 联调、7 项重启检查、浏览器四页与窄屏，独立审查闭环。

## 前置独立复核

设计及早期契约复核已收到 4 项建议：依赖 Request 注解、密码空白保留、凭据编辑语义、上传状态/块上限。已通知实现者并在 FOUNDATION_API 冻结缺失语义；代码尚在实现，最终以测试和完成后复核为准。

## 最终证据（2026-10-18 至 19）

- 主代理复跑 pytest tests：32 passed；npm test：21 passed；完整 bootstrap 安装器及生产构建成功。
- 首次媒体导入使用独立验收数据库，真实 FFmpeg/FFprobe 完成 640×360 / 12 FPS / 3 秒视频流程，21 项 HTTP 检查见 docs/acceptance/api-checks.json。
- 重启后 7 项 smoke 检查通过：认证、源保存、地址搜索、设置保存、Worker 心跳、正式库未初始化及 SPA。
- 实际浏览器检查四页、源播放、设置保存刷新和 390px 窄屏；最终截图见 docs/acceptance。
- 独立审查发现的作业租约/归档取消、前端请求顺序、错误说明和策略文案均修复并增加回归；最终复查无剩余阻断项。
- 用户已授予全权直接完成，按该授权统一提交并同步主分支；保留运行工作区，避免归档后运行路径失效。
