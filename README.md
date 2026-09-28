# 🌐 Cloud & Local Online IDE

> A modern, browser-based development environment featuring multi-language & Python ML code execution, interactive terminal powered by **xterm.js** and **node-pty**, live sandboxed web previews, and dual-mode storage (Supabase Cloud + Local File System Access API).

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [How the Core Components Work](#-how-the-core-components-work)
- [Interactive Terminal: xterm.js + node-pty](#-interactive-terminal-xtermjs--node-pty)
- [Python ML Execution & Printing Press Challenge](#-python-ml-execution--printing-press-challenge)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Running the Services](#running-the-services)
  - [Automated Verification Tests](#automated-verification-tests)
- [Security & Process Sandboxing](#-security--process-sandboxing)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

Building a browser-based IDE is one of the most rewarding full-stack engineering challenges. It sits at the intersection of:
- **Complex frontend state management**: nested file trees, multi-tab editors, unsaved state tracking, and live synchronization.
- **Modern Web APIs**: the W3C File System Access API, IndexedDB (Dexie.js), and sandboxed `<iframe>` DOM manipulation.
- **Backend systems and security**: interactive pseudo-terminal (PTY) virtualization, process confinement, execution timeouts, output capping, thread caps, and workspace isolation.

This project demonstrates two complementary storage paradigms:
1. **Cloud Projects**: Backed by **Supabase (PostgreSQL)** with local snapshot caching via **IndexedDB (Dexie.js)** for instant responsiveness and offline survivability.
2. **Local Folder Mode**: Uses the native **File System Access API** to open, edit, and save files directly to the user's local disk without uploading anything to a server.

---

## ✨ Key Features

- **Monaco Code Editor**: Powered by VS Code's editor engine (`@monaco-editor/react`), supporting syntax highlighting, intelligent indentation, cursor tracking, and keyboard navigation.
- **Integrated Interactive Terminal**: Real-time terminal powered by **xterm.js** on the frontend and **node-pty** on the backend over persistent WebSockets, supporting shell execution, keyboard shortcuts, ANSI colors, and dynamic window resizing.
- **Python ML Execution Engine**: Native support for Python machine learning workflows with pre-configured thread management and automatic plot capture for Matplotlib and Seaborn.
- **Printing Press ML Challenge**: Built-in competitive ML challenge where participants train regression models on realistic industrial printing datasets with instant feedback, scoring, and visualization.
- **Live Sandboxed Web Preview**: Instant preview of HTML/CSS/JavaScript projects. Automatically parses local stylesheets and scripts, bundles them in-memory, and renders them in an isolated `iframe` with responsive device views (Laptop, Tablet, Mobile).
- **Dual Workspace System**:
  - *Cloud Mode*: Persistent hierarchical project storage in PostgreSQL via Supabase.
  - *Local Mode*: Direct disk read/write access via Chrome/Edge File System Access API.
- **Offline & Cache Resilience**: IndexedDB caching ensures instant page reloads even before remote database queries resolve.
- **macOS-Inspired Design**: Resizable panels with width memory (`localStorage`), clean typography, custom modal dialogs, and native dark/light theme integration.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                   │
│                                                                        │
│  ┌───────────────────┐    ┌─────────────────┐    ┌──────────────────┐  │
│  │    File Tree      │    │  Monaco Editor  │    │  Output / Stdin  │  │
│  │ (Nested Explorer) │    │  (Multi-Tabs)   │    │ (Console/Status) │  │
│  └─────────┬─────────┘    └────────┬────────┘    └────────▲─────────┘  │
│            │                       │                      │            │
│            ▼                       ▼                      │            │
│     [State Coordinator: openFiles, activeId, dirty flags] │            │
│            │                                              │            │
│            ├──────────────────────┬───────────────────────┤            │
│            ▼                      ▼                       ▼            │
│     ┌──────────────┐      ┌───────────────┐      ┌─────────────────┐   │
│     │ Local Disk   │      │   IndexedDB   │      │ Preview Panel   │   │
│     │ (W3C FS API) │      │  (Dexie Cache)│      │(Isolated iframe)│   │
│     └──────────────┘      └───────────────┘      └─────────────────┘   │
│                                                           │            │
│  ┌─────────────────────────────────────────────────────┐  │            │
│  │ xterm.js Terminal (WebSocket Client)                │  │            │
│  └─────────────────────────┬───────────────────────────┘  │            │
└────────────────────────────┼──────────────────────────────┼────────────┘
                             │                              │
         WebSocket Streaming │                              │ HTTP Proxy
                             ▼                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js 16 App Router Backend                        │
│                                                                        │
│   GET/POST/DELETE /api/projects  ──► Supabase (PostgreSQL)             │
│   POST/PATCH/DELETE /api/files   ──► Supabase (PostgreSQL)             │
│   POST /api/run                  ──► Forward to Backend Service        │
│   POST /api/printing-press/run   ──► Model Scoring & Visualizer        │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Modular Terminal & Execution Service (:4000)              │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ node-pty Interactive Terminal (ws://localhost:4000/terminal)   │   │
│   │ • Real-time PowerShell / Bash PTY                              │   │
│   │ • Session reconnection grace periods & abandoned eviction      │   │
│   │ • Dynamic terminal cols/rows resize observation                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Multi-Language & ML Execution Engine (/execute)                │   │
│   │ • Python 3 (NumPy, Pandas, Scikit-learn, Matplotlib)           │   │
│   │ • Node.js (JavaScript, JSX, TSX)                               │   │
│   │ • GCC / G++ (C, C++)                                           │   │
│   │ • CPU thread caps (OMP, OpenBLAS, Loky = 4)                   │   │
│   │ • Isolated workspace directories & path traversal prevention   │   │
│   │ • Process-tree termination (taskkill / SIGKILL) & output caps  │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) | Full-stack framework, SSR, and API route handlers |
| **UI Library** | [React 19](https://react.dev/) | Client components, declarative state, hooks |
| **Editor** | [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) | Desktop-grade code editor powered by VS Code |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Semantic CSS variables, responsive design, dark mode |
| **Terminal Frontend** | [@xterm/xterm](https://xtermjs.org/) + [@xterm/addon-fit](https://www.npmjs.com/package/@xterm/addon-fit) | Web-based terminal emulator with resize observer |
| **Terminal Backend** | [node-pty](https://github.com/microsoft/node-pty) + [ws](https://github.com/websockets/ws) | Native pseudo-terminal process spawner and WebSocket server |
| **Client Storage** | [Dexie.js](https://dexie.org/) | Type-safe IndexedDB wrapper for local caching |
| **Cloud Database** | [Supabase](https://supabase.com/) | Managed PostgreSQL database with Row Level Security |
| **Python ML Engine** | NumPy, Pandas, Scikit-learn, Matplotlib | Machine learning regression modeling & data science workflows |

---

## 📁 Repository Structure

```
├── server/                    # Modular Terminal & Execution Backend Service
│   ├── index.js               # Main HTTP & WebSocket server entry point
│   ├── config.js              # Port, timeouts, resource caps, allowed env keys
│   ├── workspace.js           # Isolated workspaces, traversal security, dataset seeding
│   ├── env.js                 # Environment sanitization, thread caps, process tree kill
│   ├── runner.js              # Multi-language code execution runner with process limits
│   └── terminal.js            # node-pty terminal sessions & WebSocket streaming
├── challenges/                # Coding challenges and competitions
│   └── printing-press/        # Printing Press ML regression challenge
│       ├── data/              # train.csv, test.csv, answer_key.csv
│       ├── generator.py       # Deterministic dataset generator
│       ├── src/scorer.py      # Official validation and scoring logic
│       ├── tests/             # Challenge unit test suite
│       └── benchmark.py       # ML difficulty benchmark suite
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout with Toast and Dialog providers
│   │   ├── globals.css        # Theme variables and semantic design tokens
│   │   ├── page.tsx           # Dashboard: list projects, create, open local folder
│   │   ├── printing-press/    # Printing Press ML Challenge workspace route
│   │   ├── project/[id]/      # Cloud Project Workspace route
│   │   ├── local/             # Local Folder Workspace route
│   │   └── api/               # API route handlers (/run, /printing-press/run, /projects, /files)
│   ├── components/            # UI components (Editor, FileTree, TerminalPanel, OutputPanel, etc.)
│   ├── lib/                   # Utilities (executor, workspaceSync, localFs, localDb, supabase, etc.)
│   └── types/                 # TypeScript interfaces and declarations
├── supabase/
│   └── schema.sql             # PostgreSQL schema and RLS policies
├── scripts/
│   └── test-system.js         # Automated end-to-end service verification test
├── package.json               # Dependencies and scripts
└── tsconfig.json              # TypeScript compiler configuration
```

---

## 💻 Interactive Terminal: xterm.js + node-pty

The legacy Docker sandbox has been completely replaced with an integrated, high-performance interactive terminal architecture:

1. **Frontend (`src/components/TerminalPanel.tsx`)**:
   - Built with `@xterm/xterm` and `@xterm/addon-fit`.
   - Listens to terminal DOM container resize events via `ResizeObserver` and dispatches `{ type: "resize", cols, rows }` control frames to the backend.
   - Automatically maintains terminal dimensions when switching between Console, Terminal, and Preview panels.
   - Handles connection status messages, reconnections, and keyboard interactions.

2. **Backend (`server/terminal.js`)**:
   - Uses `node-pty` to spawn real pseudo-terminal processes (PowerShell on Windows, Bash on Linux/macOS).
   - Manages session IDs with reconnect grace periods (45 seconds), preserving running commands during brief network disconnections.
   - Automatically cleans up inactive terminal sessions (> 2 hours) and provides clean process tree termination on exit.

---

## 🤖 Python ML Execution & Printing Press Challenge

The platform provides a first-class Python machine learning execution environment:

1. **Native ML Library Support**:
   - NumPy, Pandas, Scikit-learn, Scipy, and Matplotlib are fully supported.
   - Headless graphics rendering is enforced via `MPLBACKEND=Agg`.

2. **Printing Press Challenge (`challenges/printing-press/`)**:
   - Objective: Predict `amount_printed` based on machine operating hours, speed, temperature, humidity, power stability, and paper quality.
   - `train.csv` (7,000 samples) and `test.csv` (1,500 samples) are pre-seeded into contestant workspaces.
   - `answer_key.csv` remains strictly private on the server for official scoring.
   - Visual plot generation: Plots saved to `visualization.png` or created with `plt.show()` / `plt.savefig()` are automatically captured and displayed in the IDE.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/) and npm
- [Python 3.10+](https://www.python.org/) with ML packages:
  ```bash
  pip install numpy pandas scikit-learn matplotlib
  ```
- GCC / G++ (optional, for C/C++ execution)
- Google Chrome or Microsoft Edge (for Local Folder mode)

### Environment Configuration

Create a `.env.local` file from the template:

```bash
copy .env.local.example .env.local
```

Configure your variables:

```ini
# Supabase credentials (optional for local/challenge mode)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Execution service URL
EXECUTOR_URL=http://localhost:4000
NEXT_PUBLIC_EXECUTOR_URL=http://localhost:4000
NEXT_PUBLIC_TERMINAL_WS_URL=ws://localhost:4000/terminal
```

### Running the Services

Start the backend terminal and execution service:

```bash
npm run server
```

In a separate terminal, start the Next.js frontend:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Automated Verification Tests

Verify all system capabilities (health check, Python ML execution, WebSocket interactive terminal, workspace sync):

```bash
npm test
```

---

## 🔒 Security & Process Sandboxing

Since `node-pty` and native runners interact directly with host processes, multi-layered safeguards are implemented:

- **Path Traversal Defense**: All workspace paths are strictly sanitized with directory boundary verification (`!targetDir.startsWith(WORKSPACES_ROOT)`), preventing unauthorized filesystem escapes.
- **Environment Sanitization**: Strips sensitive environment variables (such as server API secrets, database passwords, or auth keys) before passing the environment to student scripts or PTY processes.
- **CPU & Thread Caps**: Enforces `SANDBOX_THREAD_CAP` (default 4) across OpenMP, OpenBLAS, MKL, NumExpr, and Loky to prevent thread exhaustion or CPU starvation.
- **Execution Timeouts & Buffer Limits**: Enforces a 5-minute timeout per execution run with recursive process tree termination (`taskkill /T /F` on Windows, `SIGKILL` on POSIX) and caps output buffers at 2MB.
- **Private Dataset Isolation**: Hidden test answer keys (`answer_key.csv`) are kept exclusively on the server and are never copied to participant workspace directories.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl / Cmd + S` | Save the active file |
| `Alt + W` | Close the active editor tab |
| `Alt + N` | Create a new file at workspace root |
| `Alt + B` | Toggle the file explorer sidebar |

---

## 🩺 Troubleshooting

- **Server Not Running**: Run `npm run server` and verify `http://localhost:4000/health` returns `{ "ok": true }`.
- **WebSocket Terminal Fails**: Ensure port 4000 is open and not blocked by local firewall software.
- **Local Folder Permission**: In Chrome/Edge, if you refresh the page, click "Grant Access" to resume local folder editing.
- **Printing Press Error**: Ensure Python with `pandas`, `numpy`, and `scikit-learn` is installed in your system PATH.
