# Codex Handoff

## 当前定位

- 项目是专家标注平台原型，继续保持“平台主应用 + 插件”的单体结构。
- 平台层负责账号、项目、任务池、发布、质检流和管理端/用户端基础设施。
- 插件层负责各自页面 schema、校验、结果结构、详情展示、计算逻辑和模型配置。

## 当前状态

### 文档

- `README.md` 已补“新增插件模块规范”，后续新增项目模块时先按这份清单落地，再写代码。
- 当前已补“项目级说明文档”能力：管理员在具体项目 `任务管理` 页编辑 Markdown，用户标注页左侧抽屉展示说明文档并按标题自动生成目录。

### 认证与账号

- 登录已接入真实账号，不再使用前端 mock。
- 当前角色只保留 `admin` 和 `user`。
- 默认账号：
  - `admin` / `Admin@123`
  - `user` / `User@123`
- `user` 默认同时具备：
  - `can_annotate = true`
  - `can_review = true`

### 任务与质检流程

- 任务状态：
  - `annotation_pending`
  - `annotation_in_progress`
  - `pending_review_dispatch`
  - `review_pending`
  - `review_in_progress`
  - `review_submitted`
  - `approved`
- 质检轮次状态：
  - `pending`
  - `in_progress`
  - `waiting_resubmission`
  - `submitted`
- 标注任务使用共享任务池独占领取。
- 标注提交后自动创建首轮质检并进入质检队列。
- 质检打回后：
  - 任务回到原标注人的 `annotation_in_progress`
  - 系统预创建下一轮 `waiting_resubmission` 并继续绑定给原质检员
  - 标注员重提后直接复用这条等待中的质检轮次
  - 标注员放弃任务时，会一并清理等待中的质检绑定

### 用户端

- 左侧菜单当前为：
  - `任务大厅`
  - `标注任务`
  - `质检任务`
  - `提交记录`
- `任务大厅` 继续按项目展示可领取情况。
- `标注任务` 和 `质检任务` 已从“按项目聚合”改成“按实际领取的每一条 task/review 单独展示”：
  - 同一项目领取多条任务后，不再合并成一个入口
  - 每张卡片都展示具体 `task_id`，质检卡片还展示 `review_round`
  - 打回后处于 `waiting_resubmission` 的质检单会保留在列表里，但不会挡住其他任务入口
  - 标注列表里如果任务已被打回返修，会显示 `已打回，请返修`，不再和普通 `进行中` 混在一起
- 用户端具体工作页已支持按具体任务打开：
  - 标注页路由：
    - `/user/projects/:projectId/model-response-review/tasks/:taskId`
    - `/user/projects/:projectId/single-turn-search-case/tasks/:taskId`
  - 质检页路由：
    - `/user/projects/:projectId/review/:reviewId`
- 标注页放弃任务已改成按具体 `task_id` 释放，不再按项目释放，避免多条进行中任务时误释放别的单子。
- 任务大厅里的质检领取已允许继续领取同项目的下一条质检任务，只受总持有上限约束，不再因为“该项目已有我领取的质检单”而直接跳转列表。
- `model_response_review` 和 `single_turn_search_case` 标注页已接入左侧 `说明文档` 抽屉：
  - 数据来源是项目级 `instruction_markdown`
  - 目录按 Markdown 的 `# / ## / ###` 自动生成
  - 当前支持标题、段落、列表、引用、代码块、链接和图片
  - 图片当前支持普通 URL，管理员上传后的图片会以后端文件 URL 形式写入 Markdown
  - 桌面端说明抽屉当前使用更宽的浮层布局，顶部说明 + 左侧目录 + 右侧正文；中间作业区只做轻微居中收窄，不跟随抽屉开合位移

### 管理端

- 控制台仍是轻量看板。
- 项目列表页不提供导出入口。
- 具体项目的 `任务管理` 页支持 JSON 导出：
  - 入口在刷新右侧
  - 只提供 `JSON`
  - 导出接口：`/api/admin/projects/{project_id}/tasks/export?format=json`
  - 当前只导出该项目 `approved` 任务的最终通过结果
  - 不包含批注、质检历史和历史提交列表
- 具体项目的 `任务管理` 页新增 `说明文档` 配置入口：
  - 管理员编辑项目级 Markdown 说明文档
  - 支持实时预览
  - 支持按标题自动生成目录预览
  - 支持插入标题和图片
  - 图片当前走后端上传并落盘到本地 `backend/uploads/project-instructions/`，Markdown 中只保存短 URL
- 管理端 `single_turn_search_case` 任务的质检“查看详情”白屏已修复：
  - 后端插件现在会给管理端返回完整 submission detail，而不是只有 summary
  - 前端详情抽屉增加了不完整快照兜底，避免再次直接白屏

## 新增接口与路由

- 用户端任务列表：
  - `GET /api/me/projects/annotation-tasks`
  - `GET /api/me/projects/review-tasks`
- 用户端按具体单子打开：
  - `GET /api/me/projects/{project_id}/review-task/{review_id}`
  - `POST /api/me/projects/{project_id}/annotation-task/{task_id}/release`
  - `GET /api/me/projects/{project_id}`：当前会返回项目级 `instruction_markdown`
- 插件按具体标注任务加载：
  - `GET /api/plugins/model_response_review/projects/{project_id}/tasks/{task_id}`
  - `GET /api/plugins/single_turn_search_case/projects/{project_id}/tasks/{task_id}`
- 管理端项目说明文档：
  - `PATCH /api/admin/projects/{project_id}`：更新项目级 `instruction_markdown`
  - `POST /api/admin/projects/{project_id}/instruction-assets`：上传说明文档图片并返回 URL

## 数据库与迁移

- 最新迁移：
  - `backend/alembic/versions/20260324_0009_add_auth_and_simplify_roles.py`
  - `backend/alembic/versions/20260324_0010_add_task_workflow_and_user_capabilities.py`
  - `backend/alembic/versions/20260325_0011_add_review_annotations.py`
  - `backend/alembic/versions/20260326_0012_add_project_instruction_markdown.py`
- 当前数据库版本应为：
  - `20260326_0012 (head)`

## 关键文件

- 用户端任务/质检列表与入口：
  - `frontend/src/pages/user/TaskHallPage.tsx`
  - `frontend/src/pages/user/MyProjectsPage.tsx`
  - `frontend/src/pages/user/ReviewTasksPage.tsx`
  - `frontend/src/App.tsx`
- 用户端具体工作页：
  - `frontend/src/pages/user/ModelResponseReviewPage.tsx`
  - `frontend/src/pages/user/SingleTurnSearchCasePage.tsx`
  - `frontend/src/pages/user/ProjectReviewPage.tsx`
  - `frontend/src/components/ProjectInstructionMarkdown.tsx`
  - `frontend/src/services/api.ts`
  - `frontend/src/types/api.ts`
- 后端项目/任务/说明文档接口：
  - `backend/app/api/routes/admin_projects.py`
  - `backend/app/api/routes/me_projects.py`
  - `backend/app/api/routes/admin_project_tasks.py`
  - `backend/app/services/project_instruction_assets.py`
  - `backend/app/crud/projects.py`
  - `backend/app/crud/project_tasks.py`
  - `backend/app/crud/project_task_reviews.py`
  - `backend/app/models/project.py`
  - `backend/app/schemas/project.py`
- 插件具体任务加载：
  - `backend/app/plugins/model_response_review/router.py`
  - `backend/app/plugins/model_response_review/plugin.py`
  - `backend/app/plugins/model_response_review/service.py`
  - `backend/app/plugins/single_turn_search_case/router.py`
  - `backend/app/plugins/single_turn_search_case/plugin.py`
  - `backend/app/plugins/single_turn_search_case/service.py`
- 管理端页面：
  - `frontend/src/pages/admin/ProjectTasksPage.tsx`

## 已验证

 - `python -m py_compile backend/app/core/config.py backend/app/main.py backend/app/models/project.py backend/app/schemas/project.py backend/app/crud/projects.py backend/app/api/routes/admin_projects.py backend/app/api/routes/me_projects.py backend/app/services/project_instruction_assets.py backend/alembic/versions/20260326_0012_add_project_instruction_markdown.py`
- `cd frontend && npm run build`

## 当前边界

- 继续保持最小可运行，不做通用任务/标注引擎。
- 任务大厅仍按项目展示，不改成任务级大厅。
- 当前任务级入口已覆盖 `model_response_review` 和 `single_turn_search_case` 两个正式用户工作页。
- 管理端导出当前仍只支持具体项目任务页的 JSON 导出。
- 项目说明文档当前是项目级 Markdown 字段，不做独立文档系统，也不做 PDF 主展示。

## 后续可继续做

- 如果后续还有其他插件接入用户端工作页，需要补对应的“按具体 task 打开”路由和接口，不要再走按项目取当前任务的旧方式。
- 如果说明文档后续图片很多，建议把当前本地文件上传升级成对象存储或更正式的文件管理。
- 如果任务大厅后续也要更细，可以继续把大厅从项目视角改成任务视角，但当前不是必须。
- 如果导出字段还嫌多，可以继续按插件裁剪最终结果字段。

## 当前风险

- `ProjectWorkspacePage.tsx` 仍是通用兜底页，还是按项目入口，不适合未来新增需要多任务并行的插件；当前正式使用的两个插件已绕开这个问题。
- 如果本地数据库未升级到 `20260326_0012`，项目说明文档能力不会正常。
- 项目说明文档图片当前落盘在本地 `backend/uploads/`，适合当前单体最小方案，但还不是多机共享存储。
- 当前最终放行仍依赖管理员在 `review_submitted` 后手动 `approve`，不是“质检通过即自动 approved”。
