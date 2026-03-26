# Expert Label

一个基于“平台主应用 + 插件”的专家标注平台原型。

当前保持：
- 单体后端 + 单前端工程
- 平台负责项目、发布、管理端/用户端入口
- 插件负责各自的标注页面、校验、结果结构和业务逻辑

## 当前插件

- `model_response_review`
- `single_turn_search_case`

## 配置边界

平台配置放在：
- `backend/.env`
- 示例文件：`backend/.env.example`

平台全局配置只放通用项，例如：
- `APP_*`
- `API_PREFIX`
- `CORS_ORIGINS`
- `POSTGRES_*`
- `REDIS_URL`

插件自己的模型配置放在插件目录，例如：
- `backend/app/plugins/model_response_review/plugin.env`
- `backend/app/plugins/single_turn_search_case/plugin.env`

## 根目录命令

如果你习惯在仓库根目录运行命令，直接使用根级 `package.json`。

可用脚本：
- `npm run dev`
- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run build:frontend`
- `npm run setup:frontend`

说明：
- 根级 `package.json` 只管理根目录脚本需要的 Node 工具
- 前端依赖仍然放在 `frontend/package.json`
- 后端依赖仍然放在 `backend/requirements.txt`

## 首次启动

首次在新环境运行，建议先执行：

```powershell
npm install
npm run setup:frontend
cd backend
pip install -r requirements.txt
Copy-Item .env.example .env
```

如果插件需要真实模型，还要在对应插件目录创建各自的 `plugin.env`。

## 一键启动

仓库根目录：

```powershell
npm run dev
```

这个命令会：
- 启动 PostgreSQL
- 执行 Alembic 迁移
- 启动 FastAPI
- 启动前端开发服务器

## 分开启动

根目录：

```powershell
docker compose up -d
```

后端：

```powershell
cd backend
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

前端：

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## 常用验证

后端导入：

```powershell
cd backend
python -c "import app.main; print('IMPORT_OK')"
```

前端构建：

```powershell
cd frontend
npm run build
```

## 新增插件模块规范

这里说的“新增一个项目模块”，在当前仓库里默认就是“新增一个插件”。
不要把插件业务重新塞回平台层，也不要为了少改几处文件去做一个新的通用大引擎。

### 1. 先定边界

- 平台负责通用能力：项目、任务池、领取/释放、质检轮次、管理员审批、用户端/管理端壳子、统一鉴权和通用接口。
- 插件负责业务能力：页面 schema、任务 payload 校验、提交结果校验、结果落库、详情展示、AI 调用、插件自己的配置。
- 不要把插件特有字段直接加到 `Project`、`ProjectTaskReview` 这类平台通用模型里。
- 不要为了插件接入去做“通用 Task 引擎 2.0”、“多级工作流”、“审批流重构”。

### 2. 目录和命名约定

- 插件标识统一使用稳定的 `snake_case`，例如 `model_response_review`。
- 后端目录固定放在 `backend/app/plugins/<plugin_code>/`。
- 新插件目录建议至少包含：
  - `plugin.py`
  - `router.py`
  - `service.py`
  - `schemas.py`
  - `config.py`
  - `plugin.env.example`
  - `README.md`（只有这个插件确实有额外配置或说明时再写）
- 插件版本从 `1.0.0` 起，放在 `PluginMetadata` 里，不单独散落到别处。
- 插件自己的模型或 AI 配置放在插件目录里的 `plugin.env`，不要加到平台全局 `backend/.env`。

### 3. 后端接入规范

- 插件类统一在 `plugin.py` 里实现，并继承 `AnnotationPlugin`。
- 插件注册统一改 `backend/app/plugins/registrar.py`。
- 插件路由统一改 `backend/app/api/router.py`，由平台主路由显式 `include_router(...)`。
- 路由前缀统一使用 `/api/plugins/<plugin_code>`。
- 每个正式插件至少要具备这些能力：
  - `validate_task_payload`
  - `get_project_task` 或 `get_project_current_task`
  - `validate_project_submission`
  - `save_project_submission`
- 如果要完整接入当前管理端和用户端，还应补齐这些能力：
  - `list_project_task_submissions`
  - `get_latest_task_submission_detail`
  - `get_my_task_submission_detail`
  - `get_my_submission_detail`
  - `delete_project_task_data`
- 插件自己的结果表、快照表、AI 中间表由插件自己维护；平台只负责通用的 `projects`、`project_tasks`、`project_task_reviews`。
- 新增插件专属表时，只在 Alembic 里增加插件自己的迁移，不要顺手改平台主流程表结构。

### 4. 管理端接入规范

- 项目列表页 `frontend/src/pages/ProjectsPage.tsx` 保持通用，只负责看项目、发布项目、进入任务管理，不写插件业务。
- 当前仓库没有“管理端新建项目”的通用表单；新增项目记录时，只需要正确设置 `plugin_code` 和 `entry_path`，不要把插件字段塞到项目表。
- 管理端真正的插件接入点是 `frontend/src/pages/admin/ProjectTasksPage.tsx`，新增插件时通常需要补这几块：
  - 插件识别分支
  - schema 加载
  - 默认模板或默认表单值
  - `task_payload` 解析函数
  - 新建任务表单
  - 列表概览列
- 管理端质检详情如果需要结构化展示，改 `frontend/src/pages/admin/AdminProjectTaskReviewDetailDrawer.tsx`；如果暂时不需要，保留 JSON fallback 即可。
- 管理端任务接口优先复用现有 `backend/app/api/routes/admin_project_tasks.py`。
- 只要插件实现了上面的任务提交查询能力，管理员查看提交、查看质检快照、导出最终结果一般都不需要再新开一套插件专属管理接口。

### 5. 用户端接入规范

- 用户端路由统一改 `frontend/src/App.tsx`。
- 插件自己的工作页、提交详情页放在 `frontend/src/pages/user/`。
- 接口函数统一加到 `frontend/src/services/api.ts`。
- 类型统一加到 `frontend/src/types/api.ts`。
- 标注任务入口至少要补 `frontend/src/pages/user/MyProjectsPage.tsx` 的插件路由分支。
- 如果插件有单独的提交详情页，也要同步补提交记录页可跳转的目标页面。
- 当前用户端已经改成“按具体 task/review 展示”，新插件不要再走回“按项目聚合一个入口”的老路。
- 正式接入的插件应优先支持任务级路径 `/tasks/:taskId`，不要只依赖 `workspace` 兜底页。

### 6. 数据结构约定

- `Project` 只绑定项目基本信息、`plugin_code`、`entry_path` 和发布信息。
- `ProjectTask` 只保存通用任务状态、分配信息和插件任务模板 `task_payload`。
- 插件自己的提交结果要尽量做成“可独立读懂的快照”，不要强依赖运行时再拼装。
- 管理端导出现在走“最终 approved 结果导出”的路径，所以插件返回的 submission detail 应尽量稳定、自包含、便于直接序列化。
- 如果插件需要删除任务相关数据，统一通过 `delete_project_task_data` 清理自己的表，不要让平台层知道插件表细节。

### 7. 推荐的最小交付清单

- 后端：
  - 新插件目录
  - `registrar.py` 注册
  - `api/router.py` 挂路由
  - 插件自己的迁移和模型
- 前端：
  - `App.tsx` 路由
  - `services/api.ts`
  - `types/api.ts`
  - 用户端工作页
  - 管理端任务页分支
  - 需要时补管理员质检详情展示
- 配置：
  - `plugin.env.example`
- 文档：
  - 这个插件如果有额外环境变量或 AI 约束，再在插件目录补自己的 `README.md`
  - 更新 `CODEX_HANDOFF.md`
- 验证：
  - `cd backend && python -c "import app.main; print('IMPORT_OK')"`
  - `cd frontend && npm run build`

### 8. 新插件落地时优先参考的现成实现

- `backend/app/plugins/model_response_review/`
- `backend/app/plugins/single_turn_search_case/`
- `frontend/src/pages/admin/ProjectTasksPage.tsx`
- `frontend/src/pages/user/MyProjectsPage.tsx`
- `frontend/src/pages/admin/AdminProjectTaskReviewDetailDrawer.tsx`

## 当前协作约定

如果切换到新的 Codex 窗口，先阅读：
- `AGENTS.md`
- `CODEX_HANDOFF.md`

其中：
- `AGENTS.md` 放稳定规则
- `CODEX_HANDOFF.md` 放当前最新上下文

当前仓库建议只保留这几类文档：
- `AGENTS.md`
- `CODEX_HANDOFF.md`
- `README.md`
- 个别仍然有实际价值的插件局部说明

已经过时、重复、会造成误导的旧说明文件，应直接删除，不保留历史壳子。
