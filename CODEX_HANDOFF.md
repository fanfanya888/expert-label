# Codex Handoff

## 当前定位

- 项目是专家标注平台原型，保持“平台主应用 + 插件”的单体结构
- 平台层负责账号、登录、项目、共享任务池、任务发布、质检流和用户工作台
- 插件层只负责自己的表单、校验、结果结构和详情展示

## 当前已完成

### 认证与账号

- 登录已改成真实账号认证，不再使用前端 mock
- 角色只保留两类：`admin`、`user`
- 默认账号：
  - `admin` / `Admin@123`
  - `user` / `User@123`
- `user` 当前默认同时具备：
  - `can_annotate = true`
  - `can_review = true`
- 管理员可在账号页配置用户能力：
  - 仅标注
  - 仅质检
  - 标注 + 质检

### 任务工作流

- 任务状态已切到：
  - `annotation_pending`
  - `annotation_in_progress`
  - `pending_review_dispatch`
  - `review_pending`
  - `review_in_progress`
  - `review_submitted`
  - `approved`
- 标注任务使用共享任务池独占领取
- 试标提交后由管理员发起一轮或多轮质检
- 质检提交后，由管理员决定继续发起质检或直接通过
- 质检记录会保留：
  - 轮次
  - 质检人
  - 质检状态
  - 结论
  - 备注

### 用户端

- 用户左侧菜单现在有：
  - `任务大厅`
  - `标注任务`
  - `提交记录`
  - `质检任务`
- 登录后的默认首页是 `任务大厅`
- `任务大厅`支持：
  - 查看每个项目可领取的标注任务数
  - 查看每个项目可领取的质检任务数
  - 查看领题进度百分比
  - 直接申请领取标注任务
  - 直接申请领取质检任务
- 从任务大厅领取标注任务后，不再直接跳进插件任务页：
  - 现在会提示“已领取标注任务”
  - 然后跳到 `标注任务` 页，由用户从那里开始试标
- 领题限制已落到后端：
  - 试标未通过前，每个项目最多持有 1 题
  - 试标通过后，每个项目最多同时持有 2 题
  - 如果当前试标还在审核中，后端会阻止继续领新题
- `标注任务` 页已和 `任务大厅` 分开：
  - 任务大厅只负责看可领任务和领取
  - 标注任务页只显示“我已领取的标注项目”
  - 不再显示总进度、插件默认项目、已发布等多余信息
- `标注任务` 页现在会根据当前用户最新试标状态展示：
  - `开始试标`
  - `待审核`
  - `查看详情`
- 当前 `查看详情` 已覆盖两个插件：
  - `model_response_review`
  - `single_turn_search_case`
- `提交记录` 页已可用：
  - 汇总当前用户自己的试标提交记录
  - 支持从记录列表直接进入只读详情

### Model Response Review

- 进入试标页后不再显示用户左侧导航
- 页面左上角有“退出当前界面”
- 可“放弃当前任务”，放弃后题目回到共享任务池
- 提交试标后会返回 `标注任务` 页
- 页内已移除 `Task Overview` 和 `最近提交记录`
- 只读详情页已支持：
  - 从 `标注任务` 进入
  - 从 `提交记录` 进入

### Single Turn Search Case

- 进入试标页后不再显示用户左侧导航
- 页面左上角有“退出当前界面”
- 可“放弃当前任务”，放弃后题目回到共享任务池
- 提交试标后会返回 `标注任务` 页
- 页面顶部不再保留任务进度展示
- 只读详情页已支持：
  - 从 `标注任务` 进入
  - 从 `提交记录` 进入

### 管理端

- 项目列表已去掉：
  - “微服务项目发布管理”
  - “插件信息”列
- 任务管理页已支持：
  - 发布 / 下线
  - 发起质检
  - 查看质检记录
  - 质检通过
  - 删除具体任务
- Model Response Review 任务列表里已去掉：
  - 任务类型
  - Prompt

### 数据库与迁移

- 当前最新迁移：
  - `backend/alembic/versions/20260324_0009_add_auth_and_simplify_roles.py`
  - `backend/alembic/versions/20260324_0010_add_task_workflow_and_user_capabilities.py`
- 当前数据库版本：
  - `20260324_0010 (head)`
- 本轮没有新增数据库迁移

## 关键文件

- 用户能力与任务流：
  - `backend/app/models/user.py`
  - `backend/app/core/task_workflow.py`
  - `backend/app/crud/project_tasks.py`
  - `backend/app/crud/project_task_reviews.py`
- 用户端项目 / 大厅 / 提交记录 / 质检接口：
  - `backend/app/api/routes/me_projects.py`
  - `backend/app/schemas/submission_record.py`
- Model Response Review 插件接口：
  - `backend/app/plugins/model_response_review/router.py`
  - `backend/app/plugins/model_response_review/plugin.py`
  - `backend/app/plugins/model_response_review/service.py`
- Single Turn Search Case 插件接口：
  - `backend/app/plugins/single_turn_search_case/router.py`
  - `backend/app/plugins/single_turn_search_case/plugin.py`
  - `backend/app/plugins/single_turn_search_case/service.py`
- 用户端页面：
  - `frontend/src/pages/user/TaskHallPage.tsx`
  - `frontend/src/pages/user/MyProjectsPage.tsx`
  - `frontend/src/pages/user/SubmissionRecordsPage.tsx`
  - `frontend/src/pages/user/ModelResponseReviewPage.tsx`
  - `frontend/src/pages/user/ModelResponseReviewSubmissionDetailPage.tsx`
  - `frontend/src/pages/user/SingleTurnSearchCasePage.tsx`
  - `frontend/src/pages/user/SingleTurnSearchCaseSubmissionDetailPage.tsx`
  - `frontend/src/pages/user/ReviewTasksPage.tsx`
  - `frontend/src/layouts/UserLayout.tsx`
- 路由与接口封装：
  - `frontend/src/App.tsx`
  - `frontend/src/services/api.ts`
  - `frontend/src/types/api.ts`

## 已验证

- 后端导入通过：
  - `python -c "import app.main; print('IMPORT_OK')"`
- 前端构建通过：
  - `cd frontend && npm run build`
- Alembic 当前版本仍在：
  - `20260324_0010 (head)`

## 当前边界

- 仍保持最小可运行，不做通用任务引擎
- 仍是单账号单有效会话
- 当前“放弃任务回池”只支持未提交的进行中试标题目
- 当前“查看详情”只先落在：
  - `model_response_review`
  - `single_turn_search_case`
- 标注任务页仍按项目入口组织，不是“每一题明细列表”
- `提交记录` 当前只覆盖标注提交记录，不含质检提交记录

## 后续可继续做

- 标注任务页细化成“我名下每一题”的明细列表
- 已领取但长时间未提交任务的超时回收
- 管理端任务筛选和批量操作
- 指定某个质检员领取任务
- 把更多插件接入 `查看详情` 和 `提交记录`

## 当前风险

- 用户已领取但长期未提交的任务，目前没有超时回收机制
- “试标通过后最多 2 题”按项目维度控制，不是全平台总量控制
- 前端生产包体积仍偏大，`vite build` 仍会提示 chunk 过大，但不影响当前功能
