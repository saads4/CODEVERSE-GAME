"use client";

import { useState } from "react";
import Link from "next/link";
import Editor from "@/components/Editor";
import OutputPanel, { type RunResult } from "@/components/OutputPanel";
import { IconBack, IconPlay } from "@/components/icons";

// ── Icons ────────────────────────────────────────────────────────────────────

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
      <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
      <span className="w-3 h-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

function IconChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`transition-transform ${open ? "rotate-90" : ""} ${className ?? ""}`}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4V4z" />
    </svg>
  );
}

function IconCSV({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M9 1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6l-5-5zm0 1.5L12.5 7H9V2.5zM4 14a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h4v4h4v7a1 1 0 0 1-1 1H4z" />
      <text x="2.5" y="13" fontSize="4.5" fontFamily="monospace" fill="#4ec9b0" fontWeight="bold">CSV</text>
    </svg>
  );
}

function IconPython({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1C4.686 1 4 2.546 4 4v1h4v.5H2.5C1.12 5.5 0 6.62 0 8s1.12 2.5 2.5 2.5H4V12c0 1.657 1.343 3 3 3h2c1.657 0 3-1.343 3-3v-1H8v-.5h5.5c1.38 0 2.5-1.12 2.5-2.5S14.88 5.5 13.5 5.5H12V4c0-1.657-1.343-3-3-3H8z" fill="#3d7ab5" />
      <circle cx="5.5" cy="3.5" r="0.75" fill="white" />
      <circle cx="10.5" cy="12.5" r="0.75" fill="white" />
    </svg>
  );
}

// ── Starter Code ─────────────────────────────────────────────────────────────

const CODE_MAIN = `import pandas as pd
import numpy as np

# ── Printing Press ML Challenge ──────────────────────────────
# Datasets are available directly in your working directory:
train_df = pd.read_csv("train.csv")
test_df  = pd.read_csv("test.csv")

# ── Instructions ────────────────────────────────────────────
# 1. Preprocess train_df features & target ('amount_printed')
# 2. Train your ML regression model
# 3. Generate predictions for test_df
# 4. Assign predictions to 'predictions' (len == 1500)
#
# (Optional) You can also use matplotlib.pyplot or seaborn
# to plot and save figures with plt.savefig("visualization.png")
#
# predictions = ...

# ── Your model below ─────────────────────────────────────────

predictions = ...
`;

// ── File tree ─────────────────────────────────────────────────────────────────

type FileEntry = {
  name: string;
  readOnly?: boolean;
  category?: string;
};

const FILES: FileEntry[] = [
  { name: "main.py" },
  { name: "train.csv", readOnly: true },
  { name: "test.csv", readOnly: true },
];

function FileTree({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <aside className="w-[220px] shrink-0 bg-(--surface-sidebar) border-r border-(--border-hairline) flex flex-col text-[12.5px] select-none overflow-y-auto">
      {/* Explorer header */}
      <div className="h-8 px-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">
        <span>Explorer</span>
        <span className="text-[9px] font-normal text-[#4ec9b0] normal-case">Python + Plots</span>
      </div>

      {/* Project folder */}
      <button
        className="flex items-center gap-1 w-full px-2 py-0.5 text-(--text-secondary) hover:bg-(--surface-hover)"
        onClick={() => setOpen((v) => !v)}
      >
        <IconChevron open={open} className="w-4 h-4 text-(--text-tertiary)" />
        <span className="font-semibold text-[11.5px] uppercase tracking-wide truncate">
          Printing Press ML
        </span>
      </button>

      {open && (
        <ul className="pl-3 mt-1 space-y-0.5">
          {FILES.map((f) => {
            const isActive = selected === f.name;
            const isCsv = f.name.endsWith(".csv");
            return (
              <li key={f.name}>
                <button
                  onClick={() => onSelect(f.name)}
                  className={`flex items-center gap-2 w-full px-2 py-[3px] rounded-sm text-left truncate transition-colors
                    ${isActive
                      ? "bg-(--accent-run)/15 text-(--text-primary) font-medium"
                      : "text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)"
                    }`}
                >
                  {isCsv ? (
                    <IconCSV className="w-4 h-4 shrink-0 text-[#4ec9b0]" />
                  ) : (
                    <IconPython className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">{f.name}</span>
                  {f.readOnly && (
                    <span className="ml-auto text-[9px] text-(--text-tertiary) shrink-0">
                      read-only
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PrintingPressPage() {
  const [selectedFile, setSelectedFile] = useState("main.py");
  const [fileContents, setFileContents] = useState<Record<string, string>>({
    "main.py": CODE_MAIN,
  });

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const isReadOnly = selectedFile.endsWith(".csv");

  const currentCode = fileContents[selectedFile] ?? "";

  const updateCurrentCode = (newCode: string) => {
    if (isReadOnly) return;
    setFileContents((prev) => ({
      ...prev,
      [selectedFile]: newCode,
    }));
  };

  const editorValue = isReadOnly
    ? `# ${selectedFile} is a read-only competition dataset.\n# Load it in your code with:\nimport pandas as pd\ndf = pd.read_csv("${selectedFile}")\n\n# Features: printing_speed, machine_age, operating_hours, temperature,\n# humidity, power_stability, setup_time, paper_type, shift,\n# maintenance_status, machine_type, paper_quality, operator_id, etc.`
    : currentCode;

  const runCode = async () => {
    if (isReadOnly) return;
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/printing-press/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: currentCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          stdout: "",
          stderr: "",
          exitCode: -1,
          error: data.error ?? "Execution failed",
        });
      } else {
        setResult(data);
      }
    } catch (error) {
      setResult({
        stdout: "",
        stderr: "",
        exitCode: -1,
        error: error instanceof Error ? error.message : "Execution failed",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="h-screen flex flex-col bg-(--surface-panel) text-(--text-primary)">
      {/* ── Top toolbar ── */}
      <div className="h-11 grid grid-cols-3 items-center px-3 border-b border-(--border-hairline) bg-(--surface-toolbar) shrink-0">
        <div className="flex items-center gap-3">
          <TrafficLights />
          <Link
            href="/"
            title="Back to Online IDE"
            aria-label="Back to Online IDE"
            className="text-(--text-tertiary) hover:text-(--text-primary) p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
          >
            <IconBack className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="text-center text-[13px] font-medium text-(--text-secondary) truncate">
          Printing Press ML
          <span className="text-(--text-tertiary) font-normal text-[11px] ml-2 hidden sm:inline">
            Predict amount printed
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={runCode}
            disabled={running || isReadOnly}
            title={isReadOnly ? "Select a Python file to execute" : "Run file"}
            className="flex items-center gap-1.5 bg-(--accent-run) hover:bg-(--accent-run-hover) disabled:bg-black/[.06] disabled:dark:bg-white/[.08] disabled:text-(--text-tertiary) text-white text-[12.5px] font-medium h-7 px-3 rounded-md transition-colors"
          >
            <IconPlay className="w-3 h-3" />
            {running ? "Running..." : "Run Model"}
          </button>
        </div>
      </div>

      {/* ── Body: file tree + editor + output ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* File tree sidebar */}
        <FileTree selected={selectedFile} onSelect={setSelectedFile} />

        {/* Editor */}
        <section className="flex-1 min-w-0 flex flex-col bg-(--surface-editor)">
          {/* Tab bar */}
          <div className="h-[34px] flex items-center border-b border-(--border-hairline) bg-(--surface-toolbar) px-1 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-0.5 h-full">
              <div className="flex items-center gap-1.5 px-3 h-full border-b-2 border-(--accent-run) text-(--text-primary) text-[12px]">
                {selectedFile.endsWith(".csv") ? (
                  <IconCSV className="w-3.5 h-3.5 text-[#4ec9b0]" />
                ) : (
                  <IconPython className="w-3.5 h-3.5" />
                )}
                {selectedFile}
                {isReadOnly && (
                  <span className="ml-1 text-[10px] text-(--text-tertiary)">[read-only]</span>
                )}
              </div>
            </div>
          </div>

          <Editor
            filename={selectedFile}
            value={editorValue}
            onChange={isReadOnly ? () => {} : updateCurrentCode}
          />
        </section>

        {/* Output panel */}
        <section className="w-[440px] shrink-0 border-l border-(--border-hairline) flex flex-col min-h-0">
          <OutputPanel
            running={running}
            result={result}
            stdin=""
            onStdinChange={() => {}}
          />
        </section>
      </div>
    </main>
  );
}
