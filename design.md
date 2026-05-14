# 「童心事·绘本」MVP
架构 & 开发分工说明（Web 全配置版）

## 一、最终确认架构
```
┌────────────┐
│   Web UI   │  用户输入 / 配置 / 管理后台
│            │  所有操作入口
└─────┬──────┘
      │ HTTPS / JSON
┌─────▼──────┐
│  API Server│
│            │  • 业务逻辑
│            │  • LLM 编排
│            │  • 存储
└─────┬──────┘
      │ API
┌─────▼──────┐
│   LLM      │
│   Service  │
└────────────┘
```
✅ 没有 CLI
✅ 没有独立 Admin 系统
✅ Web 里包含「面向用户的界面 + 配置后台」

## 二、Web 的两种身份（同一套前端）
| 身份 | 用途 |
| --- | --- |
| 用户模式 | 输入烦恼 → 看故事 → 看绘本 |
| 配置模式 | 管理 Prompt / LLM / 模板 |

区分方式（MVP 最简）
* URL：/admin/*
* 或 Header Token（后期）

## 三、Web 配置能力清单（MVP）
✅ 可在 Web 上完成的配置

1️⃣ LLM 配置
* Provider（OpenAI / 自建）
* Model
* API Key（加密保存）
* Timeout / Retry

2️⃣ Prompt 模板管理（Web CRUD）
| 操作 | 说明 |
| --- | --- |
| 新建 | 新增情绪 / 场景模板 |
| 编辑 | 修改 Prompt |
| 删除 | 下架模板 |
| 测试 | 一键试运行 |

3️⃣ 图片 Prompt 配置
* 风格预设（插画 / 水彩 / 扁平）
* 负面词（no violence, no text）

4️⃣ 业务规则配置
* 最大页数
* 每页最大字数
* 是否允许重新生成

## 四、Server 职责（纯 API）
✅ Server 负责
* 提供 RESTful API
* 校验配置合法性
* 执行 LLM 调用
* 存储配置 & 内容
* 返回结构化结果

❌ Server 不负责
* 页面
* 手动运维操作
* 直接暴露 LLM

## 五、绘本生成流程（完整方案）

### 5.1 总体流程

默认全部生成双语（中文 + 英文），分两次 LLM 调用：

```
调用① story LLM
  → 设计角色档案卡（CharacterCard[]）
  → 用角色写中文故事（Story）
  输出：{ characters, story }

调用② story LLM（translate 端点）
  → 翻译：中文故事 + guide → 英文
  → 同时生成每页 imagePrompt（英文，引用角色描述）
  输出：{ story(含textEn), guide(含textEn), pictureBook(含imagePrompt) }

保存 /api/books
  → characters + story + guide + pictureBook 一起存入 BookItem
```

图像生成（依赖 `supportsImageGen: true` 的 API Key，可选）：
```
调用③ picture LLM（图像模型）
  → 每个角色生成定妆参考图（正面站姿 + 白色背景）
  → 返回 CharacterCard.refImageUrl

调用④ picture LLM（图像模型，多模态）
  → 每页携带出场角色 refImageUrl（≤3张）+ imagePrompt
  → 生成正式插图，存入 PictureBookPage.imageUrl
```

### 5.2 角色档案卡（Character Bible）

参考 `illustrations.md`，每个主要角色锁定以下维度：

| 维度 | 说明 |
| --- | --- |
| name / nameEn | 中英文角色名 |
| role | 主角 / 配角 |
| species | 物种 / 种族 |
| face | 脸型、眼型、特殊标记 |
| color | 毛发 / 肤色主色和过渡 |
| outfit | 服饰款式、颜色、配饰 |
| bodyType | 头身比、整体风格（如二头身Q版） |
| personality | 性格特点、习惯动作 |
| forbidden | 禁用元素 |
| refPrompt | 生成定妆图的英文 prompt |
| refImageUrl? | 定妆图 URL（图像模型生成后填入） |

**原则：单页出场角色 ≤ 3 人**（Qwen-Image-2.0 最多支持 3 个 reference_images）

### 5.3 imagePrompt 格式

每页 imagePrompt 包含：
1. 场景描述（画面构图、氛围、背景）
2. 每个出场角色的外貌描述（从档案卡提取，保证一致性）
3. 风格词尾：`Children's picture book style, soft colors, high quality`

### 5.4 客户端步骤提示

| 步骤 | 提示文字 |
| --- | --- |
| ① | 正在构建故事角色... |
| ② | 正在创作专属故事... |
| ③ | 正在生成故事内容... |
| ④ | 正在绘制角色定妆图...（有图像模型时） |
| ⑤ | 正在生成绘本插图（第 X/N 页）...（有图像模型时） |
| ⑥ | 正在保存... |

## 六、数据结构

### CharacterCard（新增）
```ts
interface CharacterCard {
  name: string         // 角色名（中文）
  nameEn: string       // 角色名（英文）
  role: string         // 主角 / 配角
  species: string      // 物种 / 种族
  face: string         // 面部特征
  color: string        // 毛发 / 肤色
  outfit: string       // 服饰
  bodyType: string     // 体型比例
  personality: string  // 性格 / 动态
  forbidden: string    // 禁用元素
  refPrompt: string    // 定妆图 prompt（英文）
  refImageUrl?: string // 定妆图 URL
}
```

### PictureBookPage（扩展）
```ts
interface PictureBookPage {
  pageNumber: number
  text: string
  textEn?: string
  imagePrompt: string   // 插图文字描述（英文）
  imageUrl?: string     // 实际插图 URL（图像模型生成后填入）
}
```

### BookItem（扩展）
```ts
interface BookItem {
  id: string
  title: { text: string; textEn?: string }
  emotion: string; scene: string; ageGroup: string
  description?: string
  mode?: 'emotion' | 'bedtime'
  theme?: string
  characters?: CharacterCard[]   // 新增
  guide: Guide
  story: Story
  pictureBook?: PictureBook
  createdAt: string
}
```

## 七、API 端点

```
POST /api/trouble          → 生成 guide（中文）
POST /api/story            → 角色档案卡 + 中文故事
POST /api/translate        → 翻译 + imagePrompt 生成（输出 pictureBook）
POST /api/character-images → 角色定妆图（图像模型，可选）
POST /api/picture-book     → 每页插图生成（图像模型多模态，可选）
GET  /api/books            → 书架列表
POST /api/books            → 保存绘本
DELETE /api/books/:id      → 删除绘本

GET    /api/admin/llm-settings
PUT    /api/admin/llm-settings
GET    /api/admin/api-keys
POST   /api/admin/api-keys
PUT    /api/admin/api-keys/:id
DELETE /api/admin/api-keys/:id
GET    /api/admin/prompts
POST   /api/admin/prompts
PUT    /api/admin/prompts/:id
DELETE /api/admin/prompts/:id
```

## 八、改动文件清单

| 文件 | 改动 |
| --- | --- |
| `src/types/index.ts` | 新增 `CharacterCard`；`PictureBookPage` 加 `imageUrl?`；`BookItem` 加 `characters?` |
| `src/lib/defaultPrompts.ts` | story system prompt 加角色设计指令；image prompt 改为携带档案格式 |
| `server/routes/story.ts` | 输出 `{ characters, story }` |
| `server/routes/translate.ts` | 同时生成 `pictureBook`（含 imagePrompt），废弃单独的 `/api/picture-book` 文字调用 |
| `server/routes/characterImages.ts` | 新建：角色定妆图生成（图像模型） |
| `server/routes/pictureBook.ts` | 改造：多模态图像生成；无图像模型时跳过 |
| `server/routes/books.ts` | 保存 `characters` |
| `server/index.ts` | 注册新路由 |
| `client/src/pages/Home.tsx` | 调整调用顺序、步骤提示、传参 |

## 九、安全与权限（MVP）
* LLM API Key 仅存 Server
* Web Admin 操作：MVP 简单 Token / 内网访问，后期账号系统
* 所有配置变更可审计

## 十、开发分工（最终版）
Web 前端
* ✅ 用户交互
* ✅ Admin 配置页
* ✅ API 调用封装

Server
* ✅ API 服务
* ✅ LLM 编排
* ✅ Prompt 管理
* ✅ 存储

LLM
* ✅ 角色档案卡生成
* ✅ 故事生成（中文）
* ✅ 翻译 + imagePrompt 生成
* ✅ 角色定妆图（图像模型）
* ✅ 绘本插图（图像模型多模态）


## 一、最终确认架构
```
┌────────────┐
│   Web UI   │  用户输入 / 配置 / 管理后台
│            │  所有操作入口
└─────┬──────┘
      │ HTTPS / JSON
┌─────▼──────┐
│  API Server│
│            │  • 业务逻辑
│            │  • LLM 编排
│            │  • 存储
└─────┬──────┘
      │ API
┌─────▼──────┐
│   LLM      │
│   Service  │
└────────────┘
```
✅ 没有 CLI​
✅ 没有独立 Admin 系统​
✅ Web 里包含「面向用户的界面 + 配置后台」

## 二、Web 的两种身份（同一套前端）
| 身份 | 用途 |
| --- | --- |
|用户模式 | 输入烦恼 → 看故事 → 看绘本 |
| 配置模式 | 管理 Prompt / LLM / 模板 |

区分方式（MVP 最简）
* URL：/admin/*
* 或 Header Token（后期）

三、Web 配置能力清单（MVP）
✅ 可在 Web 上完成的配置
1️⃣ LLM 配置
* Provider（OpenAI / 自建）
* Model
* API Key（加密保存）
*Timeout / Retry
```JSON
{
  "provider": "openai",
  "model": "gpt-4o",
  "timeout": 15000
}
```

2️⃣ Prompt 模板管理（Web CRUD）
| 操作 | 说明 |
| --- | --- |
| 新建 | 新增情绪 / 场景模板 |
| 编辑 | 修改 Prompt |
| 删除 | 下架模板 |
| 测试 | 一键试运行 |

Prompt 模板结构
```JSON
{
  "id": "fear_home_3_5",
  "meta": {
    "emotion": "害怕",
    "scene": "家里",
    "ageGroup": "3-5"
  },
  "systemPrompt": "...",
  "outputSchema": {}
}
```

3️⃣ 图片 Prompt 配置
* 风格预设（插画 / 水彩 / 扁平）
* 负面词（no violence, no text）


4️⃣ 业务规则配置
* 最大页数
* 每页最大字数
* 是否允许重新生成

## 四、Server 职责（纯 API）
✅ Server 负责
* 提供 RESTful API
* 校验配置合法性
* 执行 LLM 调用
* 存储配置 & 内容
* 返回结构化结果

❌ Server 不负责
* 页面
* 手动运维操作
* 直接暴露 LLM

## 五、API 分类（给开发用）
用户 API
```
POST /api/trouble
POST /api/story
POST /api/picture-book
GET  /api/guide
```

配置 API（Web Admin 用）
```
GET    /api/admin/llm-config
PUT    /api/admin/llm-config

GET    /api/admin/prompts
POST   /api/admin/prompts
PUT    /api/admin/prompts/:id
DELETE /api/admin/prompts/:id
```

## 六、数据存储设计（Server）
| 表 / 文件 | 内容 |
| --- | --- |
| llm_config | LLM 配置 |
| prompts  | Prompt 模板 |
| sessions | 用户会话 |
| stories | 生成故事 |
| picture_books | 绘本 |

## 七、安全与权限（MVP）
* LLM API Key 仅存 Server
* Web Admin 操作：
* MVP：简单 Token / 内网访问
* 后期：账号系统
* 所有配置变更可审计

## 八、开发分工（最终版）
Web 前端
* ✅ 用户交互
* ✅ Admin 配置页
* ✅ API 调用封装

Server
* ✅ API 服务
* ✅ LLM 编排
* ✅ Prompt 管理
* ✅ 存储

LLM
* ✅ 故事生成
* ✅ 图片 Prompt 生成
```
