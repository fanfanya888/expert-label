# Expert Label

一个早期阶段的专家标注平台骨架，当前保持单体 FastAPI + React 架构，并通过插件方式承载不同标注类型。

## 配置边界

### 平台配置

平台通用配置放在 `backend/.env`，示例文件是 [backend/.env.example](D:/AAAproject/expert-label/backend/.env.example)。

平台级配置只负责：

- `APP_NAME`
- `APP_ENV`
- `APP_HOST`
- `APP_PORT`
- `APP_DEBUG`
- `API_PREFIX`
- `CORS_ORIGINS`
- `POSTGRES_*`
- `REDIS_URL`

### 插件配置

插件自己的外部依赖配置放在各自插件目录内，不放进平台全局 `.env`。

`model_response_review` 的模型配置示例文件是：

- [plugin.env.example](D:/AAAproject/expert-label/backend/app/plugins/model_response_review/plugin.env.example)

使用时，在同目录复制为 `plugin.env` 即可。

## model_response_review 插件模型配置

当前插件预留了两个模型槽位：

- `generation`
- `review`

当前实际使用的是 `generation`，用于根据 Prompt 生成 `model_reply`。

示例配置项：

- `MODEL_RESPONSE_REVIEW_GENERATION_ENABLED`
- `MODEL_RESPONSE_REVIEW_GENERATION_PROVIDER`
- `MODEL_RESPONSE_REVIEW_GENERATION_BASE_URL`
- `MODEL_RESPONSE_REVIEW_GENERATION_API_KEY`
- `MODEL_RESPONSE_REVIEW_GENERATION_MODEL`
- `MODEL_RESPONSE_REVIEW_GENERATION_TIMEOUT`
- `MODEL_RESPONSE_REVIEW_GENERATION_TEMPERATURE`

未来如果插件需要第二套模型，可直接使用同一份插件配置中的 `REVIEW_*` 槽位，而不需要回退到平台全局配置。
