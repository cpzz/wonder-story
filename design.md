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
