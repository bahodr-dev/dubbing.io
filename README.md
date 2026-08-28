# dubbing.io — AI Video Dubbing & Translation Platform

**dubbing.io** is a production-grade AI video dubbing and translation platform built with React, TypeScript, Vite, and a strict monochrome design system.

The product allows users to upload video content, transcribe spoken dialogue, translate it into over 40 languages (with native support for **Uzbek (O'zbek)**, English, Spanish, German, Japanese, and more), synthesize studio-grade neural AI voices, and export dubbed videos with synchronized subtitles.

---

## ✨ Features

- **Strict Monochrome Design System**: Pure `#000000` & `#FFFFFF` palette with layered opacity levels, architectural typography (`Inter`, `Geist`, `JetBrains Mono`), and razor-thin borders.
- **Interactive Live Comparison Demo**: Real-time side-by-side original vs. dubbed speech comparison with switchable languages and audio playback.
- **Dubbing Studio Workspace**:
  - Custom monochrome HTML5 video canvas player with acoustic frequency halo animations.
  - Scrubbable timeline with sub-second timecode alignment (`00:00.0`).
  - Dual-track audio switcher: Instant toggle between **Original (EN)** and **Dubbed (UZ)**.
  - Synchronized canvas waveform track supporting direct seeking.
- **Neural Voice Library**: High-fidelity AI acoustic models (*Sophia*, *Farrux*, *Dilnoza*, *David*, *Elena*, *Marcus*, *Kenji*, *Amina*) with interactive Web Audio API acoustic preview playback.
- **6-Stage AI Processing Pipeline**: Realistic progress pipeline simulation with token-by-token live neural transcription stream.
- **Transcript & Subtitle Inspector**: Timestamped dual-language segment editor with inline text editing and per-segment audition buttons.
- **Projects Dashboard**: Full project management with status filters (Completed, Processing, Draft), search, and Grid/List view modes.
- **Pricing Plans**: 3-tier monochrome matrix (Free, Creator, Pro) with monthly/yearly billing toggles and feature specifications table.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/<your-username>/dubbing.io.git

# Enter the project directory
cd dubbing.io

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be running at `http://localhost:5173/`.

### Production Build
```bash
npm run build
npm run preview
```

---

## 🔐 Environment Setup

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

Set the mandatory `JWT_SECRET` key and any optional AI provider API keys:

```env
# Server
PORT=5000
NODE_ENV=development

# Authentication & Security (Mandatory)
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production

# Optional AI Providers (Whisper / DeepL / ElevenLabs)
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
DEEPL_API_KEY=
```

> **Security Note**: Never commit `.env` to version control. The server will fail to start if `JWT_SECRET` is missing.

---

## 🛡️ API Route Security Matrix

| Route | Method | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/signup` | POST | Public (Rate Limited) | Register a new user account with hashed password |
| `/api/auth/signin` | POST | Public (Rate Limited) | Authenticate user and issue 30-day JWT |
| `/api/auth/oauth` | POST | Public | Social OAuth login integration (Google/GitHub) |
| `/api/auth/me` | GET | Protected | Get profile for current authenticated user |
| `/api/projects` | GET, POST | Protected | Fetch or create projects isolated to current user |
| `/api/projects/:id` | PUT, DELETE | Protected | Update metadata or delete project (`user_id = ?`) |
| `/api/projects/:id/transcript` | PUT | Protected | Synchronize transcript segments (`user_id = ?`) |
| `/api/projects/:id/duplicate` | POST | Protected | Duplicate user's existing project (`user_id = ?`) |
| `/api/media/upload` | POST | Protected (Rate Limited) | Upload audio/video with strict extension whitelist |
| `/api/media/extract-url` | POST | Protected | Parse stream metadata from external video URLs |
| `/api/voices` | GET | Public | Fetch available studio and cloned voices |
| `/api/voices/clone` | POST | Protected | Clone and save custom neural voice profile |
| `/api/dubbing/generate` | POST | Protected | Generate AI dubbing transcript timeline |
| `/api/dubbing/export/:id/:format` | GET | Protected | Export SRT / VTT / JSON subtitles (`user_id = ?`) |

---

## 🛠️ Tech Stack
- **Frontend**: React 19 + TypeScript + Vite, Vanilla CSS (Monochrome Luxury System)
- **Backend**: Node.js + Express 5, `better-sqlite3` with WAL mode
- **Security**: JWT Authentication, `bcryptjs`, `express-rate-limit`, UUID file sandboxing
- **Audio Engine**: Web Audio API acoustics + Speech Synthesis
- **Icons**: Lucide React

---

## 📄 License
MIT License. Created by [bahodr-dev](https://github.com/bahodr-dev).
