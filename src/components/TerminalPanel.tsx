"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface TerminalRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

interface TerminalPanelProps {
  socketUrl?: string;
  filename?: string;
  content?: string;
  running?: boolean;
  result?: TerminalRunResult | null;
  onRun?: () => void;
}

export default function TerminalPanel({
  socketUrl,
  filename,
  content,
  running,
  result,
  onRun,
}: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const commandRef = useRef("");
  const promptRef = useRef<(() => void) | null>(null);
  const filenameRef = useRef(filename);
  const contentRef = useRef(content);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    filenameRef.current = filename;
    contentRef.current = content;
    onRunRef.current = onRun;
  }, [filename, content, onRun]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 12.5,
      fontFamily: "var(--font-mono, Menlo, Monaco, 'Courier New', monospace)",
      scrollback: 5000,
      theme: {
        background: "#181818",
        foreground: "#d4d4d4",
        cursor: "#58a6ff",
        cursorAccent: "#181818",
        selectionBackground: "rgba(255, 255, 255, 0.2)",
        black: "#242424",
        red: "#f85149",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
      },
    });

    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(terminalRef.current);
    terminalInstance.current = terminal;
    fitAddonRef.current = fit;

    const safeFit = () => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          fit.fit();
        }
      } catch {
        // Ignore fit layout errors during hidden states
      }
    };

    // Initial layout fit
    requestAnimationFrame(safeFit);

    const resizeObserver = new ResizeObserver(() => {
      safeFit();
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          })
        );
      }
    });

    resizeObserver.observe(terminalRef.current);

    if (!socketUrl) {
      const writePrompt = () => terminal.write("\r\n$ ");
      promptRef.current = writePrompt;
      terminal.writeln("\x1b[1;36mIDE Local Terminal Ready\x1b[0m");
      terminal.writeln("Type \x1b[1;32mrun\x1b[0m to execute the active file, or \x1b[1;33mhelp\x1b[0m for commands.");
      writePrompt();

      const input = terminal.onData((data) => {
        if (data === "\r") {
          const command = commandRef.current.trim();
          commandRef.current = "";
          terminal.write("\r\n");
          if (command === "run") {
            if (filenameRef.current && contentRef.current !== undefined && onRunRef.current) {
              onRunRef.current();
            } else {
              terminal.writeln("No runnable file is selected.");
            }
          } else if (command === "clear") {
            terminal.clear();
          } else if (command === "help") {
            terminal.writeln("  run   Execute the active file");
            terminal.writeln("  clear Clear terminal output");
            terminal.writeln("  help  Show this message");
          } else if (command) {
            terminal.writeln(`Command not available: ${command}`);
          }
          writePrompt();
          return;
        }
        if (data === "\u007f") {
          if (commandRef.current) {
            commandRef.current = commandRef.current.slice(0, -1);
            terminal.write("\b \b");
          }
          return;
        }
        if (data >= " ") {
          commandRef.current += data;
          terminal.write(data);
        }
      });

      return () => {
        input.dispose();
        resizeObserver.disconnect();
        terminalInstance.current = null;
        fitAddonRef.current = null;
        promptRef.current = null;
        terminal.dispose();
      };
    }

    // Connect to backend node-pty WebSocket
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(socketUrl);
      socketRef.current = socket;
    } catch {
      terminal.writeln("\r\n\x1b[31m[WebSocket connection error]\x1b[0m");
    }

    if (socket) {
      socket.onopen = () => {
        safeFit();
        socket?.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          })
        );
      };

      socket.onmessage = (event) => {
        terminal.write(String(event.data));
      };

      socket.onerror = () => {
        terminal.writeln("\r\n\x1b[31m[Terminal connection error — verify server is running on port 4000]\x1b[0m");
      };

      socket.onclose = () => {
        terminal.writeln("\r\n\x1b[33m[Terminal session disconnected]\x1b[0m");
      };

      const input = terminal.onData((data) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(data);
        }
      });

      return () => {
        input.dispose();
        resizeObserver.disconnect();
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
          socket.close();
        }
        socketRef.current = null;
        terminalInstance.current = null;
        fitAddonRef.current = null;
        terminal.dispose();
      };
    }

    return () => {
      resizeObserver.disconnect();
      terminalInstance.current = null;
      fitAddonRef.current = null;
      terminal.dispose();
    };
  }, [socketUrl]);

  useEffect(() => {
    const terminal = terminalInstance.current;
    if (!terminal || !result || running) return;

    terminal.write("\r\n");
    if (result.error) terminal.writeln(`\x1b[31m${result.error}\x1b[0m`);
    if (result.stdout) terminal.write(result.stdout.replace(/\n/g, "\r\n"));
    if (result.stderr) terminal.write(`\x1b[31m${result.stderr.replace(/\n/g, "\r\n")}\x1b[0m`);
    terminal.writeln(`\r\n\x1b[90mProcess exited with code ${result.exitCode}.\x1b[0m`);
    if (!socketUrl) promptRef.current?.();
  }, [result, running, socketUrl]);

  return <div ref={terminalRef} className="h-full w-full bg-(--surface-editor) p-2 overflow-hidden" />;
}

