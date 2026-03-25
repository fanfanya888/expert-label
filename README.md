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
