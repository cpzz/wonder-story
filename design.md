# 「童心事·绘本」架构说明

面向开发与维护的简要说明；与仓库代码不一致处以代码为准。

## 1. 总体架构

```
浏览器 (React)
    │  JSON / HTTP
    ▼
Express API (server/)
    │  OpenAI 兼容 API
    ▼
外部 LLM / 图像服务
```

同一套前端包含：用户创作与阅读、系统设置（API Key、故事/绘本模型、TTS 音色）。

## 2. 创作主流程（摘要）

1. `POST /api/trouble` — 家长引导 `guide`  
2. `POST /api/story` — `characters` + 中文 `story`  
3. `POST /api/translate` — 双语 `story`/`guide`，并在 `story.cover.imagePrompt` 与每页 `story.pages[].imagePrompt` 写入英文插图描述  
4. `POST /api/books` — 持久化整本 `BookItem`  
5. 若当时已配置「支持图像生成」的绘本 LLM，且存在非空的 `imagePrompt`：客户端再依次调用  
   `POST /api/qwen-image/gen-refs`、`POST /api/qwen-image/generate`（封面与内页），**仅在创建流程内触发**。

未配置绘图 Key 时跳过第 5 步；不提供单独的后台「补生成插画」接口给终端用户。

## 3. 提示词

- 运行时由 `src/lib/promptStore.ts` 提供模板，数据来自 `src/lib/defaultPrompts.ts`（内置，不落盘、无管理端 CRUD）。  
- `story`、`trouble` 等路由通过 `getPromptByType(...)` 取用。

## 4. 配置持久化

| 路径 | 内容 |
|------|------|
| `user/settings/config.json` | `apiKeys`（密文）、`llmSettings` |
| `user/settings/.key` | AES-256-GCM 主密钥 |
| `user/settings/options.json` | 情绪/场景/年龄等下拉选项 |
| `user/books/<id>/index.json` | 单本绘本元数据与正文 |

管理端写入配置：**仅** `POST /api/admin/config/persist`（见 `server/routes/admin/configPersist.ts`）。

## 5. API 端点（与 README 表一致）

业务：`/api/books`、`/api/story`、`/api/trouble`、`/api/translate`、`/api/options`、`/api/llm-status`、`/api/qwen-image/*`  

管理只读 + 持久化：`GET /api/admin/api-keys`、`GET /api/admin/llm-settings`、`POST /api/admin/config/persist`  

## 6. 关键源码索引

| 区域 | 路径 |
|------|------|
| 类型 | `src/types/index.ts` |
| 绘本文件存储 | `src/lib/booksStore.ts` |
| 应用配置 | `src/lib/configStore.ts`、`src/lib/crypto.ts`、`src/lib/storage.ts` |
| 默认提示词 | `src/lib/defaultPrompts.ts`、`src/lib/promptStore.ts` |
| 路由注册 | `server/index.ts` |
| 插图管线 | `server/routes/qwenImage.ts` |

## 7. 安全（MVP）

- API Key 仅保存在服务端本地文件，经加密写入。  
- 无独立账号体系；部署时应对管理入口与 `user/` 目录做访问控制。
