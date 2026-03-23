# Plugin Development Guide

## 1. 文档目标

本文档用于指导如何在当前专家标注平台中新增一个“专家标注类型插件”。

目标是保证：
- 新插件接入方式统一
- 平台和插件边界清晰
- 后续可以持续扩展
- Codex 或开发者都能按同样的方法开发

---

## 2. 插件是什么

在本项目中，插件指的是：

**一种独立的专家标注任务类型。**

例如：
- model_response_review
- medical_review
- content_safety_review
- policy_judgment
- legal_compliance_review

插件不等于微服务。
插件是在当前平台主应用内，以独立目录和独立协议接入的业务模块。

---

## 3. 新插件开发前必须先回答的问题

开发前，必须先写清楚以下内容：

### 3.1 基本信息
- 插件名称：
- 插件 code：
- 插件用途：
- 适用场景：

### 3.2 管理端需要做什么
- 管理员是否需要创建任务？
- 管理员是否需要发布 / 下线任务？
- 管理员是否需要查看提交记录？
- 管理员是否需要查看提交详情？

### 3.3 用户端需要做什么
- 用户是只读查看还是需要填写表单？
- 页面顺序是什么？
- 是否需要长文本展示？
- 是否需要 rubric？
- 是否需要上传文件？
- 是否需要表格？

### 3.4 后端需要存什么
- 任务表是否需要插件专属字段？
- 结果表需要哪些字段？
- 是否需要快照？
- 是否需要可追溯性？

### 3.5 是否需要模型
- 是否需要模型参与？
- 是生成模型回答还是辅助评审？
- 需要几个模型？
- 各模型分别做什么？

---

## 4. 插件目录结构规范

每个插件统一使用如下目录结构：

```text
backend/app/plugins/<plugin_code>/
├─ __init__.py
├─ plugin.py
├─ schemas.py
├─ service.py
├─ router.py
├─ config.py
├─ plugin.env.example
└─ 其他插件专属文件（如 rubric.py、constants.py）
```

### 文件职责说明

#### plugin.py

定义插件主类、元信息、schema 暴露能力、注册入口。

#### schemas.py

定义插件的 Pydantic 请求/响应模型。

#### service.py

实现插件核心业务逻辑，例如：

- 获取任务数据
- 校验提交
- 保存结果
- 调用模型

#### router.py

定义插件自己的接口路由。

#### config.py

读取插件专属配置，不要直接在 service 中解析环境变量。

#### plugin.env.example

该插件自己的环境变量模板。

#### rubric.py

如果插件有固定 rubric，建议单独放这里。

------

## 5. 插件必须具备的最小能力

每个插件至少应实现以下能力：

1. 插件元信息
2. 页面 schema
3. 校验逻辑
4. 提交逻辑
5. 可选：rubric
6. 可选：模型调用逻辑

------

## 6. 插件元信息建议

插件应至少能暴露：

- code
- name
- description
- version

示例：

```
{
    "code": "model_response_review",
    "name": "Model Response Review",
    "description": "Review and rate model responses.",
    "version": "v1"
}
```

------

## 7. 插件页面开发原则

用户端页面建议遵守以下原则：

### 7.1 页面目标

用户端页面是“做任务”的地方，不是管理后台。

### 7.2 推荐风格

- 专注
- 简洁
- 留白充足
- 卡片式布局
- 长文本可读
- 表单结构清晰

### 7.3 页面顺序

由插件自己定义，但建议固定明确，不要过度动态化。

------

## 8. 管理端开发原则

每个插件的管理端至少要考虑：

- 任务如何创建
- 哪些字段是必填
- 哪些字段是可选
- 如何发布 / 下线任务
- 如何查看提交结果

### 建议

先做最小化管理端：

- 可新建任务
- 可发布任务
- 可查看提交结果

------

## 9. 插件配置规范

### 9.1 平台配置不放这里

平台配置统一放在全局 `.env` 中。

### 9.2 插件配置放这里

该插件的模型配置、默认参数等，放在：

- `plugin.env.example`
- `config.py`

### 9.3 命名规则

推荐使用插件 code 前缀。

例如 `model_response_review`：

```
MODEL_RESPONSE_REVIEW_GENERATION_ENABLED=true
MODEL_RESPONSE_REVIEW_GENERATION_PROVIDER=mock
MODEL_RESPONSE_REVIEW_GENERATION_BASE_URL=
MODEL_RESPONSE_REVIEW_GENERATION_API_KEY=
MODEL_RESPONSE_REVIEW_GENERATION_MODEL=mock-model-response-review
MODEL_RESPONSE_REVIEW_GENERATION_TIMEOUT=30
MODEL_RESPONSE_REVIEW_GENERATION_TEMPERATURE=0.2
```

------

## 10. 多模型配置建议

如果插件未来需要多个模型，不要继续堆全局变量，而是在插件级配置中明确区分用途。

例如：

### generation 模型

用于生成模型回答

### review 模型

用于辅助评审或复核

推荐命名：

```
<PLUGIN>_GENERATION_*
<PLUGIN>_REVIEW_*
```

------

## 11. 新插件的开发流程（推荐）

### 第一步：定义插件

写清楚：

- 用途
- 输入字段
- 输出字段
- 页面顺序
- 管理端要什么
- 是否需要模型

### 第二步：先做骨架

先创建：

- plugin.py
- schemas.py
- service.py
- router.py
- config.py
- plugin.env.example

### 第三步：先打通最小闭环

V1 只要求：

- 管理员可创建任务
- 用户可完成任务
- 结果可落库
- 管理员可查看结果

### 第四步：再做增强能力

比如：

- 模型辅助生成
- 逐维度打分
- 自动评分
- 多模型协作
- 统计分析

------

## 12. 新插件和 Codex 的沟通模板

每次让 Codex 开发新插件，建议按下面结构提需求：

### 12.1 插件基本信息

- 插件名称
- 插件 code
- 插件用途
- 场景说明

### 12.2 管理端需求

- 如何建任务
- 哪些字段必填
- 哪些字段可选
- 是否支持发布 / 下线
- 是否需要查看结果

### 12.3 用户端需求

- 页面结构顺序
- 页面风格
- 交互组件
- 校验规则

### 12.4 后端需求

- 任务存什么
- 结果存什么
- 是否需要快照
- 是否需要模型调用

### 12.5 约束

- 不要改平台架构
- 不要新增微服务
- 不要做通用大引擎
- 保持插件可插拔

------

## 13. 新聊天窗口的背景摘要模板

如果需要在新的聊天窗口继续推进项目，可以先发下面这段背景：

```
我正在做一个“专家标注平台”，当前架构是：

- 平台主应用统一负责项目、任务发布、用户端入口、管理端查看结果
- 只有“专家标注类型”这一层做成可插拔插件体系
- 每个插件有自己的 plugin.py / schemas.py / service.py / router.py / config.py / plugin.env.example
- 平台配置放全局 .env
- 插件模型配置放插件目录，不放全局 .env
- 当前已经完成第一个插件 model_response_review

以后我会继续开发新的专家标注插件，请都基于这个架构继续设计，不要把系统改成全平台微服务，也不要把插件逻辑写死到平台层。
```

------

## 14. 当前推荐开发原则

1. 新插件先做最小闭环
2. 平台层不承载具体业务细节
3. 插件层承担具体业务逻辑
4. 插件配置和平台配置分离
5. 管理端、用户端、后端三层都要先拆清楚再写

------

## 15. 当前不建议做的事情

- 不要为了一个插件重构整个系统
- 不要把插件配置塞进全局 env
- 不要过早做超大通用引擎
- 不要把所有插件需求统一抽象成一套过重框架
- 不要前端直接调用模型 API

