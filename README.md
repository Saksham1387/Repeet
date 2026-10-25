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
- **Styling**: Scoped CSS & CSS Custom Properties with vintage index-card aesthetic

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

---

## 📂 Project Structure

```
repeet/
├── dist/                     # Compiled extension (load this unpacked in Chrome)
│   ├── manifest.json
│   ├── icons/
│   ├── background.js         # Service worker bundle
│   ├── content.js            # In-page React content script bundle (Shadow DOM)
│   ├── inject.js             # MAIN world network interception script
│   ├── dashboard.html        # React Dashboard application
│   ├── popup.html            # React Popup application
│   └── assets/               # Bundled JS and CSS chunks
├── icons/                    # Extension icons (16px, 48px, 128px)
├── scripts/
│   └── build.mjs             # Orchestrates Vite + esbuild compilation & watch mode
├── src/
│   ├── types/
│   │   └── index.ts          # Strongly-typed schemas (Question, Card, Messages)
│   ├── shared/
│   │   ├── srs.ts            # SuperMemo-2 (SM-2) algorithm implementation
│   │   ├── date.ts           # Date math, key formatters, relative day labels
│   │   ├── query.ts          # Due queue filters, streak counter, pluralization
│   │   ├── leetcode.ts       # Public LeetCode GraphQL fetcher & slug parser
│   │   ├── messaging.ts      # Typed chrome.runtime.sendMessage wrapper
│   │   └── storage.ts        # Typed chrome.storage.local helper
│   ├── background/
│   │   └── index.ts          # Service worker: write queue, alarms, badge & notifications
│   ├── content/
│   │   ├── inject.ts         # MAIN world monkey-patch for LeetCode check polling
│   │   ├── index.tsx         # Content script: Shadow DOM root & route observer
│   │   └── NotePanel.tsx     # React component: in-page slide-out note card & tab
│   ├── popup/
│   │   ├── App.tsx           # React toolbar popup component
│   │   ├── main.tsx          # React entry point
│   │   └── popup.css         # Popup styles
│   ├── dashboard/
│   │   ├── App.tsx           # Dashboard container with tab router
│   │   ├── Header.tsx        # Brand header with streak and live badge counts
│   │   ├── ReviewTab.tsx     # Active recall review session with hotkeys
│   │   ├── DailyLogTab.tsx   # 26-week activity heatmap & daily timeline
│   │   ├── LibraryTab.tsx    # Question directory, filters, add by link, JSON backup
│   │   ├── main.tsx          # React entry point
│   │   └── dashboard.css     # Dashboard styles
│   └── styles/
│       └── theme.css         # Color palette, chip styles, ruled lines, typography
├── SPEC.md                   # Complete architectural and behavioral specification
├── tsconfig.json             # TypeScript compiler settings
├── vite.config.ts            # Vite configuration
└── package.json
```

---

## ⌨️ Hotkeys Reference

| Context | Key | Action |
| :--- | :--- | :--- |
| **Review Card** | `Space` / `Enter` | Reveal notes / prompt answer |
| **Standard Card** | `1` | Rate **Again** (forgotten, resets interval to 1 day) |
| **Standard Card** | `2` | Rate **Hard** (minor interval increase) |
| **Standard Card** | `3` | Rate **Good** (standard SM-2 interval increase) |
| **Standard Card** | `4` | Rate **Easy** (large interval increase + ease boost) |
| **Second Look (Relearn)** | `1` | **Still fuzzy** (keep in session queue) |
| **Second Look (Relearn)** | `2` | **Got it** (finish card for today) |
| **Note Panel** | `Ctrl + Enter` / `Cmd + Enter` | Save notes |

---

## 🔍 How It Works Under The Hood

1. **Submission Interception**: When you hit "Submit" on `leetcode.com`, LeetCode polls `/submissions/detail/<id>/check/`. `src/content/inject.ts` runs in the page's `MAIN` JavaScript world, watches the `fetch` and `XMLHttpRequest` traffic, and relays Accepted events via `window.postMessage`.
2. **Shadow DOM Isolation**: The in-page note card renders inside a Shadow DOM (`#lc-repeet-host`) using React. LeetCode's styles cannot leak into Repeet, and Repeet cannot affect LeetCode's UI.
3. **Serialized Background Worker**: `src/background/index.ts` processes all mutations through an asynchronous promise chain, preventing race conditions or corrupted local storage writes.
4. **Daily Nudge**: A periodic alarm updates the toolbar badge with the count of due questions and triggers a daily notification after 8:00 AM.

For the exhaustive technical specification, data schemas, and sequence diagrams, refer to [SPEC.md](SPEC.md).

---

## 📄 License

MIT. Built for deliberate practice and long-term algorithmic mastery.
