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

## 🛠️ Tech Stack
- **Framework**: React 19 + TypeScript
- **Bundler & Tooling**: Vite
- **Styling**: Pure Architectural Vanilla CSS (Custom Design System)
- **Audio Engine**: Web Audio API + Formant Acoustics
- **Icons**: Lucide React

---

## 📄 License
MIT License. Created by [bahodr-dev](https://github.com/bahodr-dev).
