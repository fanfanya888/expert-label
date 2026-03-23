# Expert Label Platform Architecture

## 1. 项目定位

本项目是一个“专家标注平台”，目标不是把所有业务都写死在一个页面里，而是：

- 平台主应用负责通用管理能力
- 各种“专家标注类型”以插件形式接入
- 每个插件可以独立演进自己的页面、字段、校验规则和模型配置
- 平台负责项目、任务发布、用户入口、结果查看与追溯

---

## 2. 总体架构原则

本项目采用：

**平台主应用 + 专家标注插件体系**

而不是全平台微服务化。

### 为什么这样设计
因为真正变化快、差异大的部分是“专家标注类型”本身，而不是用户、项目、系统管理这些通用模块。

因此：
- 平台主应用保持统一
- 专家标注任务类型做成可插拔插件

---

## 3. 平台主应用负责什么

平台主应用统一负责以下能力：

### 3.1 基础平台能力
- 登录入口
- 角色入口（管理端 / 用户端）
- 系统信息
- 基础配置
- 数据库连接
- 通用 API 组织
- 通用异常处理
- 通用响应结构

### 3.2 项目管理
- 创建项目
- 上线 / 下线项目
- 控制项目是否对用户可见
- 绑定插件类型
- 提供项目入口路径

### 3.3 任务发布管理
- 管理员创建任务
- 管理员发布 / 下线任务
- 管理员查看项目下任务
- 管理员查看提交记录和详情
- 平台控制哪些任务对标注员可见

### 3.4 用户端入口
- 用户查看“我的项目”
- 用户进入项目工作台
- 用户进入具体插件页面
- 用户提交结果

---

## 4. 插件负责什么

每个专家标注类型插件负责自己特有的业务细节。

### 插件负责：
- 插件元信息（code / name / description / version）
- 页面结构定义
- 输入 schema
- 结果 schema
- rubric
- 校验规则
- 提交结果标准化
- 插件自己的后端 service / router
- 插件自己的模型配置
- 插件自己的模型调用逻辑

### 插件不负责：
- 平台用户体系
- 平台项目体系
- 通用任务发布后台
- 全局配置
- 全局数据库连接
- 通用认证逻辑

---

## 5. 当前已落地的插件

当前第一个正式插件为：

### model_response_review
用途：
- 对模型回答进行专家评审
- 支持 task category、answer rating、rating rationale
- 支持展示英文 rubric
- 支持结果可追溯落库
- 支持在没有 model response 时，由后端生成 model response

---

## 6. 当前目录结构说明

推荐结构如下：

```text
expert-label/
├─ ARCHITECTURE.md
├─ PLUGIN_DEV_GUIDE.md
├─ README.md
├─ docker-compose.yml
├─ backend/
│  ├─ alembic/
│  ├─ app/
│  │  ├─ api/
│  │  ├─ core/
│  │  ├─ models/
│  │  ├─ services/
│  │  ├─ modules/
│  │  ├─ annotation_core/
│  │  └─ plugins/
│  │     ├─ model_response_review/
│  │     │  ├─ plugin.py
│  │     │  ├─ schemas.py
│  │     │  ├─ service.py
│  │     │  ├─ router.py
│  │     │  ├─ rubric.py
│  │     │  ├─ config.py
│  │     │  └─ plugin.env.example
│  ├─ .env
│  ├─ .env.example
│  └─ requirements.txt
└─ frontend/
   ├─ src/
   └─ ...
```

## 7. 配置边界原则

### 7.1 平台全局配置

放在：

- `backend/.env`
- `backend/.env.example`

只放平台通用配置，例如：

- APP_NAME
- APP_ENV
- APP_HOST
- APP_PORT
- APP_DEBUG
- API_PREFIX
- CORS_ORIGINS
- POSTGRES_*
- REDIS_URL

### 7.2 插件级配置

放在插件目录中，例如：

- `backend/app/plugins/model_response_review/plugin.env.example`
- `backend/app/plugins/model_response_review/config.py`

凡是只服务于某一个插件的配置，都放在该插件目录里。

例如：

- 该插件需要的模型配置
- 该插件的默认参数
- 该插件的扩展开关

------

## 8. 数据边界原则

### 平台层数据

平台层主要管理：

- 项目
- 任务发布
- 项目可见性
- 提交记录入口
- 用户可访问项目

### 插件层数据

插件层主要管理：

- 该插件特有的任务内容结构
- 该插件特有的结果存储结构
- prompt / model_reply / rubric 快照等特有字段

------

## 9. 项目与插件的关系

### Project

Project 代表一个平台中的“项目实例”。

一个项目应至少绑定：

- plugin_code
- entry_path
- publish_status
- is_visible

也就是说：

- 插件是能力
- 项目是能力的一次业务实例

------

## 10. 任务与插件的关系

平台层管理：

- 哪些任务属于哪个项目
- 哪些任务已发布
- 哪些任务对用户可见
- 任务当前状态

插件层决定：

- 任务内容字段长什么样
- 用户如何填写
- 结果如何校验和存储

------

## 11. 新增插件的基本规则

每个新插件必须：

1. 放在 `backend/app/plugins/<plugin_code>/`
2. 拥有独立的 `plugin.py`
3. 拥有独立的 `schemas.py`
4. 拥有独立的 `service.py`
5. 拥有独立的 `router.py`
6. 拥有独立的 `config.py`
7. 拥有独立的 `plugin.env.example`
8. 能被 annotation_core 注册和发现

------

## 12. 当前开发原则

### 必须坚持

- 平台负责通用能力
- 插件负责业务细节
- 插件配置不要污染全局配置
- 每个新插件先做最小闭环
- 不轻易上升为全局通用引擎

### 暂时不做

- 全平台微服务化
- 通用超大 Task/Annotation 引擎
- 插件业务逻辑写死到平台层
- 前端直接调用模型 API
- 把插件模型配置放在全局 env

------

## 13. 当前最重要的开发目标

持续以“插件化方式”扩展新的专家标注类型，而不是重写平台架构。

每新增一个插件，都优先完成：

- 管理端可建任务
- 用户端可做任务
- 结果可追溯落库
- 管理端可查看结果

这是插件 V1 的最小闭环。