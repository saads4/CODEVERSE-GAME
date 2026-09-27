"use client";

import { useState } from "react";
import Link from "next/link";
import Editor from "@/components/Editor";
import OutputPanel, { type RunResult } from "@/components/OutputPanel";
import { IconBack, IconPlay } from "@/components/icons";

function TrafficLights() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
      <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
      <span className="w-3 h-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

const STARTER_CODE = `import pandas as pd
import numpy as np

# Printing Press ML Challenge
#
# Available variables:
# train_df -> training data with 'amount_printed'
# val_df   -> validation features without 'amount_printed'
#
# Target column:
# amount_printed
#
# Your code must create:
# predictions = ...
#
# Baseline example:
predictions = np.full(len(val_df), train_df["amount_printed"].mean())
`;

export default function PrintingPressPage() {
  const [code, setCode] = useState(STARTER_CODE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const runCode = async () => {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/printing-press/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: "main.py",
          content: code,
          stdin: "",
        }),
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
      {/* Top toolbar matching Online_IDE convention */}
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

        <div className="flex justify-end">
          <button
            onClick={runCode}
            disabled={running}
            className="flex items-center gap-1.5 bg-(--accent-run) hover:bg-(--accent-run-hover) disabled:bg-black/[.06] disabled:dark:bg-white/[.08] disabled:text-(--text-tertiary) text-white text-[12.5px] font-medium h-7 px-3 rounded-md transition-colors"
          >
            <IconPlay className="w-3 h-3" />
            {running ? "Running..." : "Run Model"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <section className="flex-1 min-w-0 bg-(--surface-editor)">
          <Editor
            filename="solution.py"
            value={code}
            onChange={setCode}
          />
        </section>

        <section className="w-[420px] shrink-0 border-l border-(--border-hairline) flex flex-col min-h-0">
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
