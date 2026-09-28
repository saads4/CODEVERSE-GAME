# Browser IDE Guide

## Requirements

- Node.js 20 or newer and npm
- A Supabase project for cloud projects (optional if running Printing Press or local mode)
- Chrome or Edge for local-folder mode
- Native compilers/interpreters for supported languages (Python, GCC/G++, Node.js)

## Install and start

```bash
npm install
copy .env.local.example .env.local
npm run server    # Starts node-pty interactive terminal and execution backend on port 4000
npm run dev       # Starts Next.js IDE frontend on port 3000
```

Open `http://localhost:3000`. Keep the terminal server (`npm run server`) running while using **Run** and the **Terminal** tab. Use `npm run lint` and `npx tsc --noEmit` for validation and type checks.

## Environment variables

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configure the browser-safe Supabase client. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name is also accepted. `EXECUTOR_URL` is the server-only URL for the execution service and defaults to `http://localhost:4000`. `NEXT_PUBLIC_TERMINAL_WS_URL` points to the interactive WebSocket terminal service (defaults to `ws://localhost:4000/terminal`).

Do not commit `.env.local`. The public Supabase anon key is protected by database policies, and service-role credentials must never use a `NEXT_PUBLIC_` prefix.

## Supabase setup/schema

1. Create a Supabase project.
2. Copy the project URL and anon key into `.env.local`.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. The included initial policies are open for this learning app. Add authentication and user-scoped RLS before production use.

Cloud project and file operations go through the Next.js API routes, which use the Supabase client on the server.

## Interactive Terminal & Execution Setup

The backend service (`executor/server.js`) provides:
1. **Interactive xterm.js + node-pty Terminal:** Real-time bidirectional WebSockets on `ws://localhost:4000/terminal` with live keyboard input, ANSI colors, process lifecycle management, resize observation, and session persistence.
2. **Workspace Sandboxing:** Each project session runs inside an isolated workspace directory (`workspaces/<projectId>`) with sanitized environment variables, preventing access to server secret keys.
3. **Native Code Runner:** Accepts `language`, `source`, and `stdin` at `POST http://localhost:4000/execute` and returns `stdout`, `stderr`, `status`, `exitCode`, and `time`.

The supported execution languages are Python (`.py`), C (`.c`), C++ (`.cpp`/`.cc`), JavaScript (`.js`), JSX (`.jsx`), and TSX (`.tsx`). HTML (`.html`/`.htm`) and CSS (`.css`) are preview files rendered in the sandboxed Preview panel.

For a direct health check:

```bash
curl http://localhost:4000/health
```

## How to use the IDE

Create a cloud project from the home page or choose **Open a Local Folder** in Chrome or Edge. Use the file explorer to create nested files and folders. Double-click a name to rename it, use the row actions to create children or delete it, and click files to open multiple tabs. Supported editor and runner files include `.py`, `.js`, `.c`, `.cpp`, `.jsx`, `.html`, and `.css`.

Use **Ctrl/Cmd+S** to save the active file. Select a runnable file and press **Run**. Enter optional stdin in the Console panel before running. Switch to the **Terminal** tab for a full interactive shell in your project workspace. The Preview panel inlines local HTML, CSS, and JavaScript into a sandboxed iframe.

## Troubleshooting

- **Server errors:** Run `npm run server` and verify `http://localhost:4000/health` returns `{ "ok": true }`.
- **Supabase errors:** verify both public variables and run `supabase/schema.sql`.
- **No local folder:** use Chrome or Edge and grant read/write permission again after a browser restart.
- **Terminal disconnected:** ensure `npm run server` is running on port 4000.

