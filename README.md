<p align="center">
  <img src="icons/repeet-logo.png" alt="Repeet logo" width="120" />
</p>

# Repeet: LeetCode Revision Deck

A local-first Google Chrome extension (Manifest V3) that passively captures every accepted LeetCode submission, lets you attach reflection notes, and resurfaces problems with Anki-style spaced repetition (SM-2).

Built with **TypeScript**, **React 18**, and **Vite**.

---

## ✨ Features

- **🎯 Zero-Friction Passive Capture**: Submit a solution on LeetCode. When the verdict is **Accepted**, the problem is automatically saved to your revision deck with metadata (title, difficulty, topic tags) and a reflection card slides out.
- **🧠 Spaced Repetition (SM-2)**: First review is scheduled for the next day. Reviews are rated *Again*, *Hard*, *Good*, or *Easy* with dynamically previewed intervals (e.g. `1d`, `3d`, `1w`, `2mo`).
- **⚡ Hotkey-Driven Active Recall**:
  - `Space` / `Enter`: Reveal reflection notes.
  - `1`, `2`, `3`, `4`: Submit your rating (*Again*, *Hard*, *Good*, *Easy*).
  - Intra-session learning step: Rating *Again* re-queues the card once in the same session.
- **📅 26-Week Activity Heatmap & Daily Log**: GitHub-style activity contribution matrix tracking daily problem solves and reviews, plus a reverse-chronological timeline.
- **📚 Searchable Library & Backups**: Search problems by title, problem number, tags, or notes. Filter by difficulty. Add problems manually by URL or slug. Export and import JSON backups.
- **🔒 Local-First & Private**: 100% of your data resides in `chrome.storage.local` on your machine. No accounts, no telemetry, no tracking.

---

## 🛠 Tech Stack

- **Extension Platform**: Chrome Manifest V3
- **Language**: TypeScript (`strict: true`)
- **Frontend Framework**: React 18 (`createRoot`, React Hooks)
- **Bundler & Tooling**: Vite 5 + esbuild (instant compilation & watch mode)
- **Styling**: Tailwind CSS v4 with scoped CSS custom properties and a vintage index-card aesthetic

---

## 📦 Quick Start & Installation

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Install Dependencies & Build
Clone or unzip this repository and run:

```bash
# Install dependencies
npm install

# Build extension for production
npm run build
```

This compiles TypeScript and bundles the React applications and extension workers into the `dist/` directory.

### 3. Load in Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button (top-left).
4. Select the **`dist`** folder inside this project directory (`/path/to/repeet/dist`).
5. Pin the **Repeet** extension icon to your Chrome toolbar.
6. Open [leetcode.com](https://leetcode.com) (or refresh any LeetCode tabs that were already open).

---

## 💻 Development Workflow

```bash
# Start development watch mode (rebuilds automatically on file changes)
npm run dev

# Run TypeScript typechecker without emitting files
npm run typecheck

# Production build
npm run build
```

When running `npm run dev`, make changes in `src/`. Once saved, go to `chrome://extensions` and click the **Reload** icon on the Repeet extension tile to load your updates.
