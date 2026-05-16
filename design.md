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

## 2. 创作主流程

```
用户填写创作表单
    ↓
POST /api/trouble → 生成家长引导
    ↓
POST /api/story → 生成角色档案卡 + 中文故事
    ↓
POST /api/translate → 翻译为双语 + 生成英文图片描述
    ↓
POST /api/books → 保存绘本到文件系统
    ↓
（若已配置图片模型）
    ↓
POST /api/qwen-image/gen-refs → 生成角色定妆图
    ↓
POST /api/qwen-image/generate → 生成封面和内页插图
```

未配置绘图 Key 时跳过插图生成步骤；不提供单独的后台「补生成插画」接口给终端用户。

## 3. 项目结构

```
wonder-story/
├── client/                      # 前端代码
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx        # 主页面（绘本列表、阅读器、创作弹窗）
│   │   │   └── Admin.tsx       # 系统设置（API Key 管理、LLM 配置、TTS 设置）
│   │   ├── App.tsx             # 路由配置
│   │   └── main.tsx            # 入口文件
│   └── index.html
├── server/                      # 后端代码
│   ├── index.ts                # Express 服务入口，路由注册
│   └── routes/
│       ├── books.ts            # 绘本 CRUD + 图片/参考图访问
│       ├── story.ts            # 生成故事 + 角色档案卡
│       ├── trouble.ts          # 生成家长引导建议
│       ├── translate.ts        # 翻译 + 生成图片描述
│       ├── qwenImage.ts        # 通义万相插图生成管线
│       ├── options.ts          # 下拉选项管理（情绪、场景、年龄、主题）
│       ├── llmStatus.ts        # LLM 配置状态检查
│       └── admin/
│           ├── apiKeys.ts      # API Key 管理（只读，写操作走 config/persist）
│           ├── llmSettings.ts  # LLM 选择查询
│           └── configPersist.ts# 配置持久化（唯一写入口）
├── src/                         # 共享库（前后端通用）
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   └── lib/
│       ├── llm.ts              # LLM 调用封装（JSON 解析、重试）
│       ├── booksStore.ts       # 绘本文件系统存储
│       ├── configStore.ts      # 配置管理（加密、持久化）
│       ├── crypto.ts           # AES-256-GCM 加密工具
│       ├── defaultPrompts.ts   # 内置提示词模板
│       ├── promptStore.ts      # 提示词运行时读取
│       ├── templateUtils.ts    # 提示词模板填充工具
│       ├── illustrationStyles.ts # 插画风格定义
│       ├── protagonistPresets.ts # 主角预设
│       ├── optionsStore.ts     # 下拉选项存储
│       └── storage.ts          # JSON 文件读写工具
└── user/                        # 运行时数据（.gitignore）
    ├── settings/
    │   ├── config.json         # 加密的 API Key + LLM 配置
    │   ├── .key                # AES 加密主密钥（切勿泄露）
    │   └── options.json        # 自定义下拉选项
    └── books/<uuid>/           # 单本绘本数据
        ├── index.json          # 绘本元数据 + 故事内容
        ├── images/             # 页面插图（0.png=封面, 1.png, 2.png...）
        └── refs/               # 角色定妆参考图（0.png, 1.png...）
```

## 4. HTTP API

### 绘本管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/books` | 绘本列表（按创建时间倒序） |
| GET | `/api/books/:id` | 单本详情 |
| POST | `/api/books` | 新建绘本 |
| DELETE | `/api/books/:id` | 删除绘本 |
| GET | `/api/books/:id/images/:pageNumber` | 获取某页插图文件 |
| GET | `/api/books/:id/refs/:index` | 获取角色定妆参考图 |

### 故事生成

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/story` | 生成角色 + 中文故事 |
| POST | `/api/trouble` | 生成家长引导 |
| POST | `/api/translate` | 翻译并写入插图描述 |

### 插图生成

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/qwen-image/gen-refs` | 生成角色定妆图 |
| POST | `/api/qwen-image/generate` | 按页生成插图 |
| POST | `/api/qwen-image/test` | 测试图片生成 API 连通性 |

### 配置管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/options` | 获取下拉选项 |
| PUT | `/api/options` | 更新下拉选项 |
| GET | `/api/llm-status` | 检查故事/绘图 Key 是否已配置 |
| GET | `/api/admin/api-keys` | 获取 Key 列表（脱敏） |
| GET | `/api/admin/llm-settings` | 获取当前 LLM 选择 |
| POST | `/api/admin/config/persist` | **唯一写入口**：保存 Key 与 LLM 设置 |

> ⚠️ 对 `/api/admin/api-keys` 的 POST/PUT/DELETE 与对 `/api/admin/llm-settings` 的 PUT 会返回 405，请改用 `config/persist`。

## 5. 提示词

- 运行时由 `src/lib/promptStore.ts` 提供模板，数据来自 `src/lib/defaultPrompts.ts`（内置，不落盘、无管理端 CRUD）。
- `story`、`trouble` 等路由通过 `getPromptByType(...)` 取用。
- 当前提示词模板：`DEFAULT_STORY_TEMPLATE`、`DEFAULT_GUIDE_TEMPLATE`、`DEFAULT_BEDTIME_STORY_TEMPLATE`、`DEFAULT_BEDTIME_GUIDE_TEMPLATE`。

## 6. 配置持久化

| 路径 | 内容 |
|------|------|
| `user/settings/config.json` | `apiKeys`（密文）、`llmSettings` |
| `user/settings/.key` | AES-256-GCM 主密钥 |
| `user/settings/options.json` | 情绪/场景/年龄等下拉选项 |
| `user/books/<id>/index.json` | 单本绘本元数据与正文 |

管理端写入配置：**仅** `POST /api/admin/config/persist`（见 `server/routes/admin/configPersist.ts`）。

`applyFullAdminPersist()` 接收前端传来的完整 `apiKeys` + `llmSettings`，用 `rowId` 区分已有 Key（服务端 id）与新建 Key（`new_` 前缀的客户端草稿 id），一次性替换内存并写入 `config.json`。

## 7. 关键源码索引

| 区域 | 路径 |
|------|------|
| 类型 | `src/types/index.ts` |
| 绘本文件存储 | `src/lib/booksStore.ts` |
| 应用配置 | `src/lib/configStore.ts`、`src/lib/crypto.ts`、`src/lib/storage.ts` |
| 默认提示词 | `src/lib/defaultPrompts.ts`、`src/lib/promptStore.ts` |
| 路由注册 | `server/index.ts` |
| 插图管线 | `server/routes/qwenImage.ts` |
| 插画风格 | `src/lib/illustrationStyles.ts` |
| 主角预设 | `src/lib/protagonistPresets.ts` |

## 8. 插图生成管线

### 角色一致性保障

为确保 AI 生成的插图中角色外观一致，系统采用 4 层机制：

1. **角色档案卡**：LLM 设计详细的物种、外貌、服饰、禁忌描述（`CharacterCard` 类型）
2. **定妆参考图**：为前 3 个角色生成标准参考图（正面站姿、白色背景），存入 `refs/` 目录
3. **多模态引用**：生成页面时将参考图的 CDN URL 作为多模态图片传入通义 API（`referenceUrls` 参数）
4. **一致性规则**：在 `buildCharacterDesc()` 生成的 prompt 中强调物种锁定、比例阶序、材质一致性、解剖锁定等规则

### 通义万相 API

- 端点：`https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- qwen-image-2.0 系列走 `messages` 格式；旧模型走 `prompt` 格式
- 参考图仅支持公网 http(s) URL，不支持 file:// 或 base64

### 防限流机制

- 每次请求间隔至少 10 秒（`REQUEST_INTERVAL_MS`）
- 遇到 429 错误自动重试，退避策略：10s → 20s → 40s（最多 3 次）

### 负面提示词

`NEGATIVE_PROMPT` 覆盖常见问题：肢体畸形、五官错乱、嵌合体、物种混合等，特别强调「不同动物融合一体」防止 AI 把多只动物特征拼在同一身体上。

## 9. LLM 调用

`src/lib/llm.ts` 封装了两个核心函数：

- `generateJSON<T>()`：调用 LLM 并解析返回的 JSON
- `generateText()`：调用 LLM 返回纯文本

### JSON 解析鲁棒性

针对 LLM 可能返回非标准 JSON 的情况：

- **括号平衡提取**：`extractBalancedJson()` 从首个 `{` 或 `[` 开始匹配，避免贪婪匹配到文末垃圾
- **代码块提取**：识别 ` ```json ... ``` ` 围栏格式
- **自动修复**：使用 `jsonrepair` 库修复常见格式错误
- **多层回退**：依次尝试 balanced → inner → trimmed，记录失败上下文

### DeepSeek 特殊处理

- 使用 `response_format: { type: 'json_object' }` 强制 JSON 输出
- System prompt 末尾追加不同措辞的 JSON 格式要求

## 10. 数据与安全

### 文件存储结构

```
user/
├── settings/
│   ├── config.json         # API Key（密文）+ LLM 配置
│   ├── .key                # AES-256-GCM 加密主密钥
│   └── options.json        # 下拉选项（情绪、场景、年龄、主题）
└── books/<uuid>/
    ├── index.json          # 绘本元数据 + 故事正文
    ├── images/             # 页面插图（PNG 格式）
    └── refs/               # 角色定妆参考图
```

### 安全机制

- **加密存储**：API Key 使用 AES-256-GCM 加密后写入 `config.json`（`src/lib/crypto.ts`）
- **主密钥隔离**：加密密钥独立存储在 `.key` 文件中
- **脱敏显示**：管理界面通过 `maskKey()` 仅显示掩码版本（如 `sk-...4o`）
- **本地优先**：所有数据存储在本地，无云端同步
- **无账号系统**：MVP 版本无用户认证，部署时需自行保护管理入口与 `user/` 目录

> ⚠️ `user/` 目录已加入 `.gitignore`，切勿将 `.key` 文件或密文上传到公开仓库。

## 11. 部署

### 开发环境

```bash
npm run dev  # 同时启动前端（3001）和后端（3002）
```

### 生产环境

1. 构建前端静态文件：
```bash
npm run build  # 输出到 dist/client/
```

2. 启动后端服务：
```bash
npm start  # 仅启动 API 服务（默认端口 3002）
```

3. 配置反向代理（以 Nginx 为例）：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/dist/client;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

4. 保护管理入口：使用 Nginx 基本认证、IP 白名单或自定义认证中间件。

### 环境变量

- `PORT`：后端服务端口（默认 3002）

## 12. 开发指南

### 添加新的插画风格

编辑 `src/lib/illustrationStyles.ts`，添加新的风格定义：

```typescript
{
  id: 'your-style-id',
  name: '你的风格名称',
  prompt: 'English prompt for this style...'
}
```

同时在前端 `client/src/pages/Home.tsx` 的 `ILLUSTRATION_STYLES` 数组中添加对应项。

### 添加新的主角预设

编辑 `src/lib/protagonistPresets.ts`，在 `PROTAGONIST_PRESET_OPTIONS` 数组中添加新选项。

### 自定义提示词

编辑 `src/lib/defaultPrompts.ts` 中的对应模板（`DEFAULT_STORY_TEMPLATE` 等），修改 `systemPrompt` 或 `userPromptTemplate`。模板变量使用 `{variableName}` 格式，由 `fillTemplate()` 填充。

### 调试

后端日志会输出详细的调用信息：
```
[story] bedtime mode, ageGroup=5, theme=动物朋友
[generate] ① 正在构建故事角色...
[generate] 故事+角色完成: 6 页, 2 个角色
```

所有 console 输出已自动添加时间戳（见 `server/index.ts` 中的 `patchConsole()`）。
