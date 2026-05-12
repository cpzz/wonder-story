# 童心事·绘本

用一个故事，陪孩子走过每一种情绪。

一款基于大语言模型的儿童绘本生成应用，支持**情绪故事**和**睡前故事**两种模式，帮助家长用温暖的故事陪伴孩子处理情绪、进入梦乡。

---

## 功能特性

- **情绪故事**：根据孩子的情绪、场景、年龄生成专属绘本故事，并附家长引导建议
- **睡前故事**：根据主题和年龄生成舒缓的睡前故事，帮助孩子放松入睡
- **内置阅读器**：翻页式阅读，含封面、家长引导页和故事正文
- **自动朗读**：Web Speech API TTS，支持语音开关与语音选择
- **绘本图片**：可选接入图像生成模型，为每页生成插画
- **多模型支持**：兼容 OpenAI、DeepSeek、阿里云、百度、智谱、月之暗面、字节跳动、移动云等主流 LLM 提供商
- **提示词配置**：可在设置页自定义各模式的故事和引导提示词模板
- **本地文件存储**：每本绘本独立存储于 `usr/<UUID>/index.json`，无需数据库

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5 + TypeScript + Tailwind CSS v3 |
| 后端 | Express 4 + tsx (TypeScript) |
| LLM | OpenAI SDK v4（自定义 baseURL 支持任意兼容提供商） |
| 存储 | 本地 JSON 文件（`data/`、`usr/`） |
| 安全 | AES-256-GCM 加密存储 API Key |

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装

```bash
git clone https://github.com/cpzz/wonder-story.git
cd wonder-story
npm install
```

### 启动开发服务器

```bash
npm run dev
```

- 前端：http://localhost:3001

### 生产构建

```bash
npm run build       # 构建前端
npm start           # 启动后端（需先构建）
```

---

## 配置说明

点击主界面右上角齿轮图标，打开**系统设置**窗口：

### 大模型配置

选择用于**故事生成**和**绘图**的 API Key。

### API 密钥管理

添加、编辑、删除大模型 API Key。支持以下提供商：

| 提供商 | 推荐模型 |
|---|---|
| OpenAI | gpt-4o |
| DeepSeek（深度求索） | deepseek-chat |
| 阿里云（通义千问） | qwen-max |
| 百度（文心一言） | ernie-4.0-8k |
| 智谱 AI（GLM） | glm-4-flash |
| 月之暗面（Moonshot） | moonshot-v1-8k |
| 字节跳动（豆包） | doubao-pro-4k |
| 移动云（cmecloud） | 自定义 |
| 自定义 | 任意 OpenAI 兼容接口 |

> 勾选"支持图像生成"的 Key 才会出现在绘图模型选项中。

---

## 项目结构

```
wonder-story/
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx        # 主页面（书单 + 阅读器 + 创作）
│   │   └── Admin.tsx       # 系统设置弹窗
│   └── types/              # TypeScript 类型定义
├── server/
│   ├── index.ts            # Express 服务入口
│   └── routes/             # API 路由
│       ├── books.ts
│       ├── story.ts
│       ├── trouble.ts
│       ├── pictureBook.ts
│       ├── options.ts
│       ├── llmStatus.ts
│       └── admin/
│           ├── apiKeys.ts
│           ├── llmSettings.ts
│           └── prompts.ts
├── src/lib/
│   ├── llm.ts              # LLM 调用封装
│   ├── booksStore.ts       # 绘本存储
│   ├── configStore.ts      # API Key & LLM 设置
│   ├── promptStore.ts      # 提示词模板
│   └── defaultPrompts.ts   # 内置默认提示词
├── data/                   # 配置文件（不提交）
└── usr/                    # 用户绘本数据（不提交）
```

---

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/books` | 获取所有绘本 |
| POST | `/api/books` | 保存绘本 |
| DELETE | `/api/books/:id` | 删除绘本 |
| POST | `/api/story` | 生成故事 |
| POST | `/api/trouble` | 生成家长引导 |
| POST | `/api/picture-book` | 生成绘本图片描述 |
| GET | `/api/llm-status` | 查询 LLM 配置状态 |
| GET/POST/PUT/DELETE | `/api/admin/api-keys` | API Key 管理 |
| GET/PUT | `/api/admin/llm-settings` | 大模型配置 |
| GET/POST/PUT/DELETE | `/api/admin/prompts` | 提示词模板管理 |

---

## 数据安全

- API Key 使用 AES-256-GCM 加密后写入 `data/config.json`
- 加密主密钥存储于 `data/.key`
- `data/` 和 `usr/` 已加入 `.gitignore`，不会提交到代码仓库

---

## License

MIT
