# Codex Handoff

## 当前定位

- 项目是专家标注平台原型，保持“平台主应用 + 插件”的单体结构。
- 平台层负责账号、项目、任务池、发布、质检流和用户工作台。
- 插件层负责各自的表单、校验、结果结构和详情展示。

## 当前状态

### 认证与账号

- 登录已经接到真实账号，不再使用前端 mock。
- 角色只保留 `admin` 和 `user`。
- 默认账号：
  - `admin` / `Admin@123`
  - `user` / `User@123`
- `user` 默认同时具备：
  - `can_annotate = true`
  - `can_review = true`

### 任务与质检流

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
- 试标提交后会自动创建第一轮质检并进入质检队列。
- 质检打回后：
  - 任务回到原标注人的 `annotation_in_progress`
  - 系统预创建下一轮 `waiting_resubmission` 并绑定给原质检员
  - 标注员重提后直接复用这条质检轮次，不回大厅重新领
  - 标注员放弃任务时，会一并清掉这条等待中的质检绑定
- 质检记录当前会保留：
  - 轮次
  - 质检员
  - 质检状态
  - 结论
  - 整体说明
  - 结构化模块批注 `review_annotations`

### 用户端

- 左侧菜单当前为：
  - `任务大厅`
  - `标注任务`
  - `质检任务`
  - `提交记录`
- `任务大厅` 当前支持：
  - 查看每个项目可领取的标注任务数
  - 查看每个项目可领取的质检任务数
  - 查看领取进度百分比
  - 首次试标前显示 `申请领取标注`
  - 试标通过后显示 `领取标注`
  - 直接 `领取质检`
- 标注领取限制：
  - 试标未通过前，每项目最多同时持有 `1` 个
  - 试标通过后，每项目最多同时持有 `2` 个
  - 试标审核中时，后端会阻止继续领取新标注
- 质检领取限制：
  - 同一用户最多同时持有 `3` 个质检任务
  - `waiting_resubmission` 也占这 `3` 个名额
- 从大厅领取标注/质检后，不再直接跳进工作页，而是提示成功后跳到 `标注任务` / `质检任务`。
- `质检任务` 列表只展示我已领取的质检项目；被打回待重提的任务会继续留在列表中，不需要回大厅重领。
- 质检工作页现在和标注工作页一样，不再走 `UserLayout` 控制台壳子；进入后不会再显示左侧导航，也不会把顶部标题误判成 `任务大厅`。
- 重新进入质检页时，不再自动回填上一轮的整体说明；上一轮整体说明只在顶部提示里作为历史参考展示。
- `model_response_review` 和 `single_turn_search_case` 都会把上一轮模块批注带入右侧抽屉。
- `提交记录` 统一汇总标注提交和质检提交，只保留：
  - `提交类型 / 项目 / 当前状态 / 提交时间`
- `提交记录` 按“同一任务 + 提交类型”去重：
  - 同一任务即使经历多轮 `标注 -> 质检 -> 标注 -> 质检`
  - 也只保留最新一条标注记录和最新一条质检记录

### Model Response Review

- 标注页不再显示左侧用户导航。
- 左上角保留“退出当前界面”，支持“放弃当前任务”。
- 当前已落地统一工作台：
  - 主内容恢复单列
  - 右侧是可抽拉的批注抽屉
  - 首次标注不能写批注
  - 被打回后，标注员可通过右侧抽屉查看模块批注并继续修改
  - 质检页已切成与标注页一致的工作台结构
  - 质检员可通过右侧抽屉按模块填写批注
  - 重新进入同一质检任务时，会自动带入上一轮模块批注；上一轮整体说明只作为顶部历史参考展示
- 当前模块批注覆盖：
  - `任务类型`
  - `Prompt`
  - `模型回答`
  - `回答评级`
  - `评级理由`

### Single Turn Search Case

- 标注页不再显示左侧用户导航。
- 左上角保留“退出当前界面”，支持“放弃当前任务”。
- 标注页在任务被打回后，会自动回填最近一次提交的完整 case 内容，不会再被默认空表单覆盖。
- 标注页在任务被打回且存在模块批注时，会显示右侧可抽拉的批注抽屉，供标注员按模块查看修改意见。
- 只读详情仍可从：
  - `标注任务`
  - `提交记录`
进入。
- 质检页已经切成和标注页一致的工作台结构：
  - 左侧按原标注模块展示完整 case
  - 右侧是可抽拉的批注抽屉
  - 重新进入同一质检任务时，会自动带入上一轮模块批注；上一轮整体说明只作为顶部历史参考展示
- 标注提交完整 case 时，前端会在校验失败后自动滚动到第一个未通过的位置，不再停在原地无反馈。
- 提交完整 case 时，如果后端返回 `评分规则` 相关校验失败，前端会展示具体原因：
  - 规则数量不在范围内
  - 扣分项数量不足
  - 缺少正向规则
  - 某条规则的具体字段不合法
- 当前模块批注覆盖：
  - `出题信息区`
  - `模型一回复录入区`
  - `模型二回复录入区`
  - `参考答案区`
  - `评分规则区`
  - `自动统计区`

### 管理端

- 项目列表已去掉“微服务项目发布管理”和“插件信息”列。
- 首轮质检不再由管理员手动发起：
  - 用户提交后自动进入 `review_pending`
  - 管理员只在 `review_submitted` 之后决定是否追加下一轮质检或直接通过
- 管理端任务列表里已去掉 `查看试标`。

## 数据库与迁移

- 最新迁移：
  - `backend/alembic/versions/20260324_0009_add_auth_and_simplify_roles.py`
  - `backend/alembic/versions/20260324_0010_add_task_workflow_and_user_capabilities.py`
  - `backend/alembic/versions/20260325_0011_add_review_annotations.py`
- 当前数据库版本应为：
  - `20260325_0011 (head)`
- “质检绑定原质检员 / 提交记录去重 / 质检页自动带入上一轮意见 / single_turn_search_case 质检工作台”这些变更没有新增迁移。
- `single_turn_search_case` 提交详情这次补了 `latest_review` 返回字段，但没有新增迁移。

## 关键文件

- 工作流与领取逻辑：
  - `backend/app/core/task_workflow.py`
  - `backend/app/crud/project_tasks.py`
  - `backend/app/crud/project_task_reviews.py`
- 用户端大厅 / 质检队列 / 提交记录接口：
  - `backend/app/api/routes/me_projects.py`
- 插件提交流：
  - `backend/app/plugins/model_response_review/service.py`
  - `backend/app/plugins/single_turn_search_case/service.py`
- 用户端页面：
  - `frontend/src/pages/user/TaskHallPage.tsx`
  - `frontend/src/pages/user/MyProjectsPage.tsx`
  - `frontend/src/pages/user/ReviewTasksPage.tsx`
  - `frontend/src/pages/user/SubmissionRecordsPage.tsx`
  - `frontend/src/pages/user/ModelResponseReviewPage.tsx`
  - `frontend/src/pages/user/ProjectReviewPage.tsx`
  - `frontend/src/pages/user/modelResponseReviewWorkspace.tsx`
  - `frontend/src/pages/user/singleTurnSearchCaseReviewWorkspace.tsx`

## 已验证

- 前端构建通过：
  - `cd frontend && npm run build`

## 当前边界

- 继续保持最小可运行，不做通用任务引擎。
- 仍是单账号单有效会话。
- “放弃任务回池”当前只支持未再次提交前的进行中标注题目。
- 管理端已经能看质检轮次和整体说明，但还没有专门收结构化批注的查看/复用界面。

## 后续可继续做

- 管理端补结构化批注查看与使用。
- 做长时间未提交任务的超时回收。
- 补管理端任务筛选和批量操作。

## 当前风险

- 如果本地数据库未升级到 `20260325_0011`，`review_annotations` 相关能力不会正常。
- 质检通过后的最终放行仍依赖管理员，不是“质检通过即自动 approved”。
- 前端产物包体积仍偏大，`vite build` 依旧会提示 chunk 过大，但不影响当前功能。
