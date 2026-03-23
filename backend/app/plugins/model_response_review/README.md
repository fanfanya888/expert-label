# model_response_review

`model_response_review` 是平台中的一个专家标注类型插件。

## 配置文件

插件自己的模型配置不放在平台全局 `backend/.env` 中，而是放在当前目录下：

- 示例文件：`plugin.env.example`
- 实际配置：`plugin.env`

## 当前模型槽位

### generation

用于根据任务 Prompt 生成 `model_reply`。

配置项：

- `MODEL_RESPONSE_REVIEW_GENERATION_ENABLED`
- `MODEL_RESPONSE_REVIEW_GENERATION_ALLOW_MOCK_FALLBACK`
- `MODEL_RESPONSE_REVIEW_GENERATION_PROVIDER`
- `MODEL_RESPONSE_REVIEW_GENERATION_BASE_URL`
- `MODEL_RESPONSE_REVIEW_GENERATION_API_KEY`
- `MODEL_RESPONSE_REVIEW_GENERATION_MODEL`
- `MODEL_RESPONSE_REVIEW_GENERATION_TIMEOUT`
- `MODEL_RESPONSE_REVIEW_GENERATION_TEMPERATURE`

其中：

- `MODEL_RESPONSE_REVIEW_GENERATION_ALLOW_MOCK_FALLBACK=false`
  表示真实模型访问失败时直接报错，便于排查真实链路
- `MODEL_RESPONSE_REVIEW_GENERATION_ALLOW_MOCK_FALLBACK=true`
  表示真实模型失败时允许自动回退到本地 mock

### review

当前阶段只是预留，不参与现有提交链路。后续如果插件需要第二套模型，可以直接使用这一组配置，而不必改平台全局配置结构。
