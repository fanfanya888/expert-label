# model_response_review

`model_response_review` 是当前平台里的正式专家标注插件之一。

## 插件职责

用于对模型回答做人工评审，当前已支持：
- 项目维度任务读取
- 生成模型回答
- 人工评审提交
- 提交记录查看

## 配置位置

这个插件自己的模型配置不放在平台全局 `backend/.env`，而是放在当前目录：
- 示例文件：`plugin.env.example`
- 实际配置：`plugin.env`

## 当前模型槽位

### generation

用于根据任务 Prompt 生成 `model_reply`。

主要配置项：
- `MODEL_RESPONSE_REVIEW_GENERATION_ENABLED`
- `MODEL_RESPONSE_REVIEW_GENERATION_ALLOW_MOCK_FALLBACK`
- `MODEL_RESPONSE_REVIEW_GENERATION_PROVIDER`
- `MODEL_RESPONSE_REVIEW_GENERATION_BASE_URL`
- `MODEL_RESPONSE_REVIEW_GENERATION_API_KEY`
- `MODEL_RESPONSE_REVIEW_GENERATION_MODEL`
- `MODEL_RESPONSE_REVIEW_GENERATION_TIMEOUT`
- `MODEL_RESPONSE_REVIEW_GENERATION_TEMPERATURE`

说明：
- `ALLOW_MOCK_FALLBACK=false`
  真实模型失败时直接报错，适合排查链路
- `ALLOW_MOCK_FALLBACK=true`
  真实模型失败时允许自动回退到本地 mock

### review

当前只预留，不参与现有主流程。

后续如果这个插件需要第二套模型能力，可以继续使用这组插件级配置，不需要回退到平台全局配置。

