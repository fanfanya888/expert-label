## 角色

你正在帮助构建一个专家标注平台。

当前仓库遵循：
- 平台主应用 + 插件
- 单体应用
- 最小可运行、清晰可扩展

不要擅自扩大范围，不要为了“看起来完整”而引入假复杂度。

## 开始工作前必须做的事

每次进入当前仓库，先读这两个文件：
1. `AGENTS.md`
2. `CODEX_HANDOFF.md`

规则：
- `AGENTS.md` 只放稳定规则
- `CODEX_HANDOFF.md` 只放当前动态上下文、近期进展、待办和风险

如果用户切换到新的 Codex 窗口，新窗口应默认先读 `CODEX_HANDOFF.md`，不要等待用户重复解释上下文。

## 当前架构边界

平台负责：
- 项目管理
- 项目/任务发布与下线
- 管理端壳子
- 用户端入口
- 统一数据库、接口、页面基础设施

插件负责：
- 自己的页面 schema
- 自己的校验逻辑
- 自己的结果结构
- 自己的详情展示
- 自己的计算逻辑
- 自己的模型配置

不要做：
- 通用大 Task/Annotation 引擎
- 微服务重构
- 复杂工作流或审批流
- 把插件业务硬写到平台层

## 工程原则

- 优先最小可运行
- 优先清晰而不是炫技
- 优先稳定结构而不是过早抽象
- 单个文件职责尽量单一
- 不做无关重构
- 不保留无意义历史垃圾内容

## 文档维护规则

后续窗口必须主动维护 `CODEX_HANDOFF.md`。

更新时遵循：
- 只保留当前有效内容
- 已解决的问题不要保留历史流水账
- 旧结论失效后直接覆盖
- 优先写现状、边界、待办、风险
- 不要把它写成长日志

## 当前技术栈

后端：
- Python 3.12
- FastAPI
- SQLAlchemy 2.0
- Alembic
- PostgreSQL

前端：
- React
- TypeScript
- Vite
- Ant Design

## 依赖与配置边界

平台通用配置放在：
- `backend/.env`

插件自己的模型配置放在各自插件目录，不放到平台全局 `.env`。

例如：
- `backend/app/plugins/model_response_review/plugin.env`
- `backend/app/plugins/single_turn_search_case/plugin.env`

## 根目录使用习惯

用户习惯在仓库根目录执行命令。

因此：
- 常用启动脚本应优先补到根级 `package.json`
- 根级 `package.json` 只放根目录脚本需要的 Node 工具
- 前端业务依赖继续放 `frontend/package.json`
- 后端依赖继续放 `backend/requirements.txt`

## 默认工作方式

如果用户没有特别要求，默认应：
1. 先读取 `CODEX_HANDOFF.md`
2. 再读相关代码
3. 直接动手实现
4. 改完后更新 `CODEX_HANDOFF.md`

