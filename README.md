# 童心事·绘本

用一个故事，陪孩子走过每一种情绪。

基于大语言模型的儿童绘本应用，支持**情绪故事**与**睡前故事**，附家长引导与可选插图生成。

---

## 功能特性

- **情绪故事**：按情绪、场景、年龄生成故事，并附家长引导建议  
- **睡前故事**：按主题与年龄生成舒缓睡前故事  
- **阅读器**：翻页阅读（封面、故事页），Web Speech 朗读与音色选择  
- **可选插图**：创作流程中若已配置支持文生图的 API Key，会在保存绘本后依次生成定妆参考图与内页/封面图（仅创建时尝试，无单独「补生成」入口）  
- **多模型**：OpenAI 兼容接口，可在管理里配置多家提供商的 Key  

故事与引导使用的提示词为代码内置（`src/lib/defaultPrompts.ts`），不提供 Web 端修改。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5 + TypeScript + Tailwind CSS v3 |
| 后端 | Express 4 + tsx |
| LLM | OpenAI SDK v4（自定义 `baseURL`） |
| 存储 | 本地 JSON：`user/settings/`（配置、选项）、`user/books/<id>/`（绘本与图片） |
| 安全 | API Key 使用 AES-256-GCM，密钥在 `user/settings/.key` |

---

## 快速开始

**环境**：Node.js 18+、npm 9+

```bash
git clone https://github.com/cpzz/wonder-story.git
cd wonder-story
npm install
npm run dev
```

- 前端：<http://localhost:3001>（Vite 将 `/api` 代理到后端）  
- 后端 API：<http://localhost:3002>（或由环境变量 `PORT` 指定）

```bash
npm run build   # 构建前端 → dist/client
npm start       # 仅启动 API（默认 :3002）；生产环境需自行托管 dist/client 中的静态文件并反代 /api 到本服务
```

---

## 配置说明

主界面右上角齿轮打开**系统设置**：

- **API Key**：添加、编辑密钥；勾选「支持图像生成」的 Key 可作为绘本绘图模型  
- **故事 / 绘本 LLM**：选择对应 Key  
- 点击**保存设置**会通过 `POST /api/admin/config/persist` 一次性写入 `user/settings/config.json`  

---

## 项目结构（节选）

```
wonder-story/
├── client/src/pages/       # Home.tsx、Admin.tsx
├── server/
│   ├── index.ts
│   └── routes/             # books、story、trouble、translate、qwenImage、options、llm-status、admin/*
├── src/
│   ├── types/index.ts
│   └── lib/                # llm、booksStore、configStore、promptStore、defaultPrompts、optionsStore…
└── user/                   # 本地数据（.gitignore，含 settings 与 books）
```

---

## HTTP API（摘要）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/books` | 绘本列表 |
| GET | `/api/books/:id` | 单本详情 |
| POST | `/api/books` | 新建绘本 |
| DELETE | `/api/books/:id` | 删除绘本 |
| GET | `/api/books/:id/images/:pageNumber` | 某页插图文件 |
| GET | `/api/books/:id/refs/:index` | 角色定妆参考图 |
| POST | `/api/story` | 生成角色 + 中文故事 |
| POST | `/api/trouble` | 生成家长引导 |
| POST | `/api/translate` | 翻译并在 `story.cover` / `story.pages[].imagePrompt` 中写入插图描述 |
| GET | `/api/options` | 下拉选项 |
| PUT | `/api/options` | 更新下拉选项 |
| GET | `/api/llm-status` | 是否已配置故事/绘图 Key |
| POST | `/api/qwen-image/gen-refs` | 生成角色定妆图（内部/创作流程） |
| POST | `/api/qwen-image/generate` | 按页生成插图（内部/创作流程） |
| POST | `/api/qwen-image/test` | 连通性测试 |
| GET | `/api/admin/api-keys` | Key 列表（脱敏） |
| GET | `/api/admin/llm-settings` | 当前 LLM 选择 |
| POST | `/api/admin/config/persist` | **唯一写入口**：保存 Key 与 LLM 设置 |

对 `/api/admin/api-keys` 的 POST/PUT/DELETE 与对 `/api/admin/llm-settings` 的 PUT 会返回 405，提示改用 `config/persist`。

---

## 数据与安全

- `user/settings/config.json`：API Key（密文）、LLM 选中项  
- `user/settings/.key`：本地加密主密钥（勿泄露、勿与密文分离后乱删）  
- `user/settings/options.json`：创作表单下拉项（首次运行自动生成）  
- `user/books/<uuid>/`：每本绘本的 `index.json`、插图与定妆图  

`user/` 已加入 `.gitignore`。

---

## License

MIT
