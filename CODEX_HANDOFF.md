# Codex Handoff

## 当前定位

- 项目是专家标注平台原型，保持“平台主应用 + 插件”的单体结构。
- 平台层负责账号、项目、任务池、发布、质检流和管理端/用户端基础设施。
- 插件层负责各自页面 schema、校验、结果结构、详情展示、计算逻辑和模型配置。

## 当前状态

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
  - 系统预创建下一轮 `waiting_resubmission` 并绑定给原质检人
  - 标注员重提后直接复用这条质检轮次，不回大厅重新领取
  - 标注员放弃任务时，会一并清理等待中的质检绑定
- 质检记录当前保留轮次、质检人、状态、结论、整体说明和结构化 `review_annotations`。

### 用户端

- 左侧菜单当前为：
  - `任务大厅`
  - `标注任务`
  - `质检任务`
  - `提交记录`
- `任务大厅` 支持查看各项目可领取的标注/质检任务数和领取进度。
- 标注领取限制：
  - 试标未通过前，每项目最多同时持有 1 个
  - 试标通过后，每项目最多同时持有 2 个
- 质检领取限制：
  - 同一用户最多同时持有 3 个质检任务
  - `waiting_resubmission` 也占这 3 个名额
- 从大厅领取成功后，会跳转到 `标注任务` 或 `质检任务`，不再直接进入工作页。
- `提交记录` 统一汇总标注提交和质检提交，并按“同一任务 + 提交类型”去重，只保留最新记录。

### 插件工作台

- `model_response_review` 和 `single_turn_search_case` 都已切成统一工作台形态：
  - 标注页不再显示左侧用户导航
  - 左上保留退出当前界面/放弃当前任务
  - 打回后可通过右侧抽屉查看结构化质检批注
- 质检页与标注页使用一致工作台结构，重新进入同一质检任务时会自动带回上一轮模块批注。

### 管理端

- 控制台已改成基于项目列表的轻量数据看板。
- 项目管理页保留项目、发布状态、任务统计、发布时间和操作列，不再放数据导出入口。
- 管理端项目任务页支持 JSON 导出：
  - 入口位于具体项目的 `任务管理` 页
  - 按钮放在该页顶部的“刷新”右侧
  - 当前弹窗只提供 `JSON` 格式
  - 导出只保留当前项目里最终审核通过的结果数据
  - 不包含批注、质检历史和历史提交列表
  - 导出接口为 `/api/admin/projects/{project_id}/tasks/export?format=json`
  - 当前返回结构为 `project + approved_results`
- `single_turn_search_case` 与 `model_response_review` 的任务/模板管理页已统一成紧凑表格风格。
- 首轮质检不再由管理员手动发起；管理员只在 `review_submitted` 后决定追加下一轮质检或直接通过。
- 管理端查看质检抽屉已支持只读查看每轮详情。

## 数据库与迁移

- 最新迁移：
  - `backend/alembic/versions/20260324_0009_add_auth_and_simplify_roles.py`
  - `backend/alembic/versions/20260324_0010_add_task_workflow_and_user_capabilities.py`
  - `backend/alembic/versions/20260325_0011_add_review_annotations.py`
- 当前数据库版本应为：
  - `20260325_0011 (head)`

## 关键文件

- 工作流与领取逻辑：
  - `backend/app/core/task_workflow.py`
  - `backend/app/crud/project_tasks.py`
  - `backend/app/crud/project_task_reviews.py`
- 管理端任务导出：
  - `backend/app/api/routes/admin_project_tasks.py`
  - `frontend/src/pages/admin/ProjectTasksPage.tsx`
  - `frontend/src/services/api.ts`
- 管理端任务/质检详情：
  - `backend/app/api/routes/admin_project_tasks.py`
  - `frontend/src/pages/admin/AdminProjectTaskReviewDetailDrawer.tsx`
- 用户端页面：
  - `frontend/src/pages/user/TaskHallPage.tsx`
  - `frontend/src/pages/user/MyProjectsPage.tsx`
  - `frontend/src/pages/user/ReviewTasksPage.tsx`
  - `frontend/src/pages/user/SubmissionRecordsPage.tsx`

## 已验证

- `python -m py_compile backend/app/api/routes/admin_project_tasks.py`
- `cd frontend && npm run build`

## 当前边界

- 继续保持最小可运行，不做通用任务/标注引擎。
- 仍是单账号单有效会话。
- 任务放弃回池目前只覆盖未再次提交前的进行中标注任务。
- 管理端导出当前只支持具体项目任务页的 JSON 导出，不支持项目列表页导出，也不支持 CSV/Excel。
- 导出当前只保留 `approved` 任务的最终结果数据，未扩展成通用审计导出。

## 后续可继续做

- 如果后续还嫌结果字段杂，可继续按插件分别裁剪导出字段口径。
- 把管理端历史质检详情从时间推断升级成显式 `review/submission` 绑定。
- 增加长时间未提交任务的超时回收。
- 补管理端任务筛选和批量操作。
- 如果后续需要更多导出格式，可在任务管理页导出弹窗和 `/tasks/export` 接口上继续扩展 CSV/Excel。

## 当前风险

- 如果本地数据库未升级到 `20260325_0011`，`review_annotations` 相关能力不会正常。
- 质检通过后的最终放行仍依赖管理员，不是“质检通过即自动 approved”。
- 当前“最终通过数据”依赖插件现有的 `get_latest_task_submission_detail` / `list_project_task_submissions` 能力；如果后续需要更严格的审计口径，可能还要补显式导出接口。
