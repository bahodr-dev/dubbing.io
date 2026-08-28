# dubbing.io — AI Video Dubbing & Translation Platform

**dubbing.io** is a production-grade AI video dubbing and translation platform built with React, TypeScript, Vite, Express 5, SQLite, and a strict monochrome design system.

The product allows users to upload video content, transcribe spoken dialogue, translate it into over 40 languages (with native support for **Uzbek (O'zbek)**, English, Spanish, German, Japanese, and more), synthesize studio-grade neural AI voices, and export dubbed videos with synchronized subtitles.

---

## ✨ Features

- **Strict Monochrome Design System**: Pure `#000000` & `#FFFFFF` palette with layered opacity levels, architectural typography (`Inter`, `Geist`, `JetBrains Mono`), and razor-thin borders.
- **Production-Grade Real Authentication**:
  - Email + Password registration and sign-in with `bcryptjs` password hashing.
  - Real **Google OAuth 2.0 / OpenID Connect** with PKCE state verification.
  - Real **GitHub OAuth 2.0** with verified primary email retrieval.
  - Real **Microsoft Identity Platform (Entra ID)** with OpenID Connect.
  - Secure **HTTP-only session cookies** (`SameSite=Lax`, `Secure` in production) with Bearer token compatibility.
  - Multi-tenant data isolation and anti-replay OAuth state validation.
- **Interactive Live Comparison Demo**: Real-time side-by-side original vs. dubbed speech comparison with switchable languages and audio playback.
- **Dubbing Studio Workspace**:
  - Custom monochrome HTML5 video canvas player with acoustic frequency halo animations.
  - Scrubbable timeline with sub-second timecode alignment (`00:00.0`).
  - Dual-track audio switcher: Instant toggle between **Original (EN)** and **Dubbed (UZ)**.
  - Synchronized canvas waveform track supporting direct seeking.
- **Neural Voice Library**: High-fidelity AI acoustic models (*Sophia*, *Farrux*, *Dilnoza*, *David*, *Elena*, *Marcus*, *Kenji*, *Amina*) with interactive Web Audio API acoustic preview playback.
- **6-Stage AI Processing Pipeline**: Realistic progress pipeline simulation with token-by-token live neural transcription stream and background asynchronous job queue.
- **Transcript & Subtitle Inspector**: Timestamped dual-language segment editor with inline text editing and per-segment audition buttons.
- **Projects Dashboard**: Full project management with status filters (Completed, Processing, Draft), search, and Grid/List view modes.
- **Pricing Plans**: 3-tier monochrome matrix (Free, Creator, Pro) with monthly/yearly billing toggles and feature specifications table.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### Installation & Local Run
```bash
# 1. Clone the repository
git clone https://github.com/bahodr-dev/dubbing.io.git
cd dubbing.io

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env

# 4. Initialize & seed the SQLite database
npm run seed

# 5. Start full-stack development (frontend on :5173 and backend API on :5000)
npm run dev
```

The application will be running at `http://localhost:5173/`.

### Run Automated Tests & Quality Verification
```bash
# Run complete test suite (Vitest + Supertest + React Testing Library)
npm run test

# Run linter
npm run lint

# Build production bundle
npm run build
```

---

## 🔐 Authentication & OAuth Provider Setup

### 1. Environment Configuration (`.env`)
Create `.env` by copying `.env.example`:
```env
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5173
API_URL=http://localhost:5000

# Security (MANDATORY)
JWT_SECRET=your_super_secure_256bit_jwt_secret_key_here

# 1. Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# 2. GitHub OAuth Credentials
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:5000/api/auth/github/callback

# 3. Microsoft OAuth Credentials
MICROSOFT_CLIENT_ID=your_azure_client_id
MICROSOFT_CLIENT_SECRET=your_azure_client_secret
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/auth/microsoft/callback
```

---

### 2. Provider Developer Portal Steps

#### 🌐 Google Cloud OAuth Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** > **Credentials**.
3. Click **Create Credentials** > **OAuth client ID**.
4. Application type: **Web application**.
5. Set **Authorized JavaScript origins**:
   - `http://localhost:5173` (Development)
   - `https://yourdomain.com` (Production)
6. Set **Authorized redirect URIs**:
   - `http://localhost:5000/api/auth/google/callback` (Development)
   - `https://api.yourdomain.com/api/auth/google/callback` (Production)
7. Copy **Client ID** and **Client Secret** into your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

#### 🐙 GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/developers) > **OAuth Apps**.
2. Click **New OAuth App**.
3. Application name: `dubbing.io`
4. Homepage URL: `http://localhost:5173`
5. **Authorization callback URL**:
   - `http://localhost:5000/api/auth/github/callback` (Development)
   - `https://api.yourdomain.com/api/auth/github/callback` (Production)
6. Click **Register application**, generate a client secret, and copy into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

#### 🪟 Microsoft Azure Entra ID Setup
1. Go to the [Microsoft Entra Admin Center](https://entra.microsoft.com/) (or Azure Portal > **App registrations**).
2. Click **New registration**.
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (`common`).
4. Redirect URI: Platform **Web**, URI:
   - `http://localhost:5000/api/auth/microsoft/callback` (Development)
   - `https://api.yourdomain.com/api/auth/microsoft/callback` (Production)
5. Under **Certificates & secrets**, create a **New client secret**.
6. Copy Application (client) ID and secret value into `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.

---

## 🛡️ API Route Security Matrix

| Route | Method | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/signup` | POST | Public (Rate Limited) | Register a new user account with hashed password |
| `/api/auth/signin` | POST | Public (Rate Limited) | Authenticate user and issue 30-day session cookie / JWT |
| `/api/auth/signout` | POST | Public | Invalidate and clear session cookie |
| `/api/auth/me` | GET | Protected | Get verified profile for current authenticated user |
| `/api/auth/google` | GET | Public | Initiate secure Google OAuth flow with PKCE |
| `/api/auth/google/callback` | GET | Public | Validate Google authorization code & establish session |
| `/api/auth/github` | GET | Public | Initiate secure GitHub OAuth flow |
| `/api/auth/github/callback` | GET | Public | Validate GitHub authorization code & establish session |
| `/api/auth/microsoft` | GET | Public | Initiate secure Microsoft OAuth flow with PKCE |
| `/api/auth/microsoft/callback` | GET | Public | Validate Microsoft authorization code & establish session |
| `/api/projects` | GET, POST | Protected | Fetch or create projects isolated to current user |
| `/api/projects/:id` | PUT, DELETE | Protected | Update metadata or delete project (`user_id = ?`) |
| `/api/projects/:id/transcript` | PUT | Protected | Synchronize transcript segments (`user_id = ?`) |
| `/api/media/upload` | POST | Protected (Rate Limited) | Upload audio/video with strict extension whitelist |
| `/api/media/extract-url` | POST | Protected | Parse stream metadata from external video URLs via oEmbed |
| `/api/voices` | GET | Public | Fetch available studio and cloned voices |
| `/api/dubbing/process` | POST | Protected | Start asynchronous AI dubbing pipeline job |
| `/api/dubbing/jobs/:jobId` | GET | Protected | Poll real-time progress for active dubbing job |
| `/api/dubbing/transcribe` | POST | Protected | Transcribe audio via Whisper API / Acoustic segmenter |
| `/api/dubbing/translate` | POST | Protected | Translate dialogue via GPT / DeepL adapter |
| `/api/dubbing/synthesize` | POST | Protected | Synthesize neural speech via ElevenLabs / OpenAI TTS |
| `/api/dubbing/export/:id/:format` | GET | Protected | Export SRT / VTT / JSON subtitles (`user_id = ?`) |

---

## 🛠️ Tech Stack
- **Frontend**: React 19 + TypeScript + Vite, Vanilla CSS (Monochrome Luxury System)
- **Backend**: Node.js + Express 5, `better-sqlite3` with WAL mode
- **Authentication**: HTTP-only Cookies + JWT, `bcryptjs`, OAuth 2.0 / OIDC (Google, GitHub, Microsoft), `express-rate-limit`
- **Testing**: Vitest, Supertest, React Testing Library, JSDOM
- **Audio Engine**: Web Audio API acoustics + ElevenLabs / OpenAI Neural Synthesizer

---

## 📄 License
MIT License. Created by [bahodr-dev](https://github.com/bahodr-dev).
