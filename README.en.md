# Wonder Story · Picture Books

One story at a time, through every emotion.

An LLM-powered children's picture book app that supports **emotional stories** and **bedtime stories**, with parent guidance and optional illustration generation.

---

## Features

### 📖 Story Creation
- **Emotional Stories**: Generate stories by emotion type, scene, and age to help children understand and manage their feelings
- **Bedtime Stories**: Generate soothing bedtime stories by theme and age, woven with imagery of night, stars, and dreams
- **Parent Guidance**: Each picture book comes with professional parenting advice to help understand children's emotions

### 🎨 Illustration Generation
- **Character Reference Sheets**: Generate standard reference images for each character to ensure consistency
- **Page Illustrations**: Auto-generate cover and inner page illustrations with 9 illustration styles
- **Multimodal Reference**: Use character reference sheets as visual references to keep character appearance consistent across pages

### 📚 Reading Experience
- **Page-by-page Reading**: Browse cover and story pages with page-turn navigation
- **Voice Narration**: Web Speech API-based bilingual narration (Chinese/English)
- **Auto-play**: Automatically advance pages after narration, great for independent use
- **Voice Selection**: Customize Chinese/English narration voices

### ⚙️ System Management
- **Multi-model Support**: Compatible with OpenAI, DeepSeek, Qwen, Zhipu AI, and other major providers
- **Key Management**: Add multiple API Keys for story generation and illustration generation separately
- **Secure Encryption**: API Keys encrypted with AES-256-GCM

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 8 + TypeScript + Tailwind CSS v3 |
| Backend | Express 4 + tsx (TypeScript runtime) |
| LLM | OpenAI SDK v4 (compatible with all OpenAI-format APIs) |
| Image Generation | Qwen Image (Alibaba Cloud DashScope API) |
| Storage | Local JSON file system |
| Security | AES-256-GCM encrypted API Keys |

---

## Quick Start

**Prerequisites**: Node.js 18+, npm 9+

```bash
git clone https://github.com/cpzz/wonder-story.git
cd wonder-story
npm install
npm run dev
```

- Frontend: <http://localhost:3001> (Vite proxies `/api` to backend)
- Backend API: <http://localhost:3002> (or set via `PORT` environment variable)

```bash
npm run build   # Build frontend → dist/client
npm start       # Start API only (default :3002); for production, host static files from dist/client and reverse-proxy /api to this service
```

---

## Configuration

### First-time Setup

1. Click the ⚙️ icon in the top-right corner to open **System Settings**
2. Switch to the "LLM Configuration" tab
3. Click "Add API Key" and fill in:
   - **Provider**: Choose from presets (OpenAI, DeepSeek, Qwen, etc.) or custom
   - **Name**: A recognizable label (e.g., "My GPT-4o")
   - **Model**: Model name (e.g., `gpt-4o`, `qwen-max`)
   - **Base URL**: API base URL (auto-filled by presets)
   - **API Key**: Your API key
   - **Supports Image Generation**: Check this if the key supports text-to-image (e.g., Qwen Image)

4. Select the corresponding key in the "Story Model" and "Illustration Model" dropdowns
5. Click "Save Settings"

### Supported Provider Presets

- OpenAI (gpt-4o)
- Anthropic (claude-3-5-sonnet)
- DeepSeek (deepseek-chat)
- Alibaba Qwen (qwen-max)
- Baidu ERNIE (ernie-4.0-8k)
- Zhipu AI (glm-4-flash)
- Moonshot (moonshot-v1-8k)
- ByteDance Doubao (doubao-pro-4k)
- CMCC Cloud (cmecloud)

> 💡 **Tip**: Story generation only requires a standard LLM key. Illustration generation requires a key that supports text-to-image (e.g., Alibaba Cloud's `qwen-image-2.0-pro`).

---

## Creation Workflow

### 1️⃣ Choose Story Mode

**Emotional Story Mode**:
- Required: Child's age (2-14), emotion type, scene
- Optional: Illustration style, protagonist preset, specific description

**Bedtime Story Mode**:
- Required: Child's age (2-14)
- Optional: Story theme, illustration style, protagonist preset, extra ideas

**Illustration Styles** (9 options): Fresh Watercolor (default), Cute & Healing, Minimal Flat, Cartoon Exaggerated, Retro Classic, Chinese Ink, Collage Handcraft, Realistic Detailed, Printmaking Decorative

### 2️⃣ AI Content Generation

The system automatically completes these steps:

1. **Analyze Emotions** → Generate parent guidance (understanding methods + 4 practical tips)
2. **Build Characters** → Design 2-4 character cards (species, appearance, outfit, personality)
3. **Create Story** → Generate a 6-8 page warm story (2-3 sentences per page)
4. **Translate Content** → Generate bilingual (Chinese/English) version + English illustration descriptions per page
5. **Save Book** → Persist to local file system
6. **Generate Illustrations** (requires image model configuration):
   - Generate character reference sheets (standard pose, white background)
   - Generate cover illustration (1024×1024)
   - Generate inner page illustrations one by one (maintaining character consistency)

### 3️⃣ Reading

- Click a book in the left sidebar to open the reader
- Use the bottom navigation bar to turn pages, or click dots to jump
- Click "💛 Note for Parents" to view guidance
- Use "中/EN" to switch narration language
- Click "▶" to enable auto-play

---

## Data Notes

- All book data is stored locally in the `user/` directory (included in `.gitignore`)
- API Keys are encrypted; the admin interface only shows masked versions
- **Do not delete** `user/settings/.key`, otherwise saved API Keys cannot be decrypted
- Regularly back up the `user/` directory

---

## FAQ

### Q: Which AI models are supported?

A: Any LLM API compatible with the OpenAI format. Tested providers include:
- **Story generation**: OpenAI GPT-4o, DeepSeek, Qwen, Zhipu GLM, etc.
- **Illustration generation**: Alibaba Cloud Qwen Image (`qwen-image-2.0-pro`)

### Q: Why is illustration generation slow?

A: To avoid API rate limiting, the system enforces a minimum 10-second interval between requests. An 8-page book typically takes 1-2 minutes to complete all illustrations.

### Q: Can I regenerate illustrations?

A: The current version only auto-generates illustrations during book creation. Standalone regeneration is not yet supported.

### Q: Will my data be lost?

A: All data is stored locally in the `user/` directory. Regular backups are recommended. Do not delete the `.key` file, otherwise saved API Keys cannot be decrypted.

## License

Apache License 2.0

---

💝 One story at a time, through every emotion.
