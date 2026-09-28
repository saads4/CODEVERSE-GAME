"use client";

import { useState, useEffect } from "react";
import type { ValidationFeedback } from "@/app/api/printing-press/run/route";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileStderr?: string;
  error?: string;
  status?: string;
  time?: string | null;
  memory?: number | null;
  image?: string | null;
  validation?: ValidationFeedback | null;
}

interface OutputPanelProps {
  running: boolean;
  result: RunResult | null;
  stdin: string;
  onStdinChange: (value: string) => void;
  defaultTab?: "console" | "validation" | "plots";
}

export default function OutputPanel({
  running,
  result,
  stdin,
  onStdinChange,
  defaultTab = "console",
}: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState<"console" | "validation" | "plots">(defaultTab);

  // Auto-switch to validation tab when fresh validation feedback arrives, or plots if only image arrives
  useEffect(() => {
    if (result?.validation) {
      // Keep on current tab if user selected, otherwise default to validation if passed or failed
      if (activeTab === "console" && result.validation.status === "passed") {
        setActiveTab("validation");
      }
    } else if (result?.image && activeTab === "plots") {
      setActiveTab("plots");
    }
  }, [result]);

  const hasValidation = Boolean(result?.validation);
  const hasImage = Boolean(result?.image);

  const status = running
    ? { color: "bg-amber-400", label: "Running" }
    : result?.error || (result && result.exitCode !== 0)
      ? { color: "bg-(--accent-stop)", label: `Exit ${result?.exitCode ?? "—"}` }
      : result
        ? { color: "bg-(--accent-run)", label: "Exit 0 (OK)" }
        : { color: "bg-(--text-tertiary)", label: "Idle" };

  const valStatus = result?.validation?.status;

  return (
    <div className="h-full flex flex-col bg-(--surface-editor) text-neutral-200 font-(family-name:--font-mono) text-[12.5px]">
      {/* ── Panel Header / Tabs ── */}
      <div className="flex items-center justify-between px-2 h-9 border-b border-white/10 bg-(--surface-toolbar) shrink-0 font-(family-name:--font-ui) text-[11.5px] select-none">
        <div className="flex items-center gap-1 h-full">
          {/* Console Tab */}
          <button
            onClick={() => setActiveTab("console")}
            className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-colors ${
              activeTab === "console"
                ? "border-(--accent) text-white font-medium"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${status.color}`} />
            <span>Terminal</span>
          </button>

          {/* Challenge Feedback Tab */}
          {hasValidation && (
            <button
              onClick={() => setActiveTab("validation")}
              className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-colors ${
                activeTab === "validation"
                  ? "border-(--accent) text-white font-medium"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span>Feedback</span>
              {valStatus === "passed" && (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9.5px] font-semibold">
                  {result?.validation?.points ?? 0} pts
                </span>
              )}
              {valStatus === "failed" && (
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9.5px] font-semibold">
                  Check Hints
                </span>
              )}
              {valStatus === "error" && (
                <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[9.5px] font-semibold">
                  Error
                </span>
              )}
            </button>
          )}

          {/* Plots Tab */}
          {hasImage && (
            <button
              onClick={() => setActiveTab("plots")}
              className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-colors ${
                activeTab === "plots"
                  ? "border-(--accent) text-white font-medium"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <svg className="w-3.5 h-3.5 text-[#4ec9b0]" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z" />
              </svg>
              <span>Plots</span>
            </button>
          )}
        </div>

        {/* Header Right Status */}
        <div className="flex items-center gap-2 pr-1 text-[11px] text-neutral-400 font-(family-name:--font-mono)">
          {result?.time && <span>{result.time}s</span>}
          <span className="text-neutral-500">{status.label}</span>
        </div>
      </div>

      {/* ── Tab Content: Console / Terminal ── */}
      {activeTab === "console" && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Stdin box */}
          <div className="border-b border-white/10 p-2 shrink-0 bg-(--surface-toolbar)/50">
            <label className="block text-[10px] uppercase tracking-wide text-neutral-500 mb-1 font-(family-name:--font-ui)">
              Stdin (Input stream)
            </label>
            <textarea
              value={stdin}
              onChange={(event) => onStdinChange(event.target.value)}
              placeholder="Input passed to the next run"
              rows={2}
              className="w-full resize-y rounded border border-white/10 bg-black/20 px-2 py-1.5 text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-(--accent) text-[11.5px]"
            />
          </div>

          {/* Console stdout / stderr streams */}
          <div className="flex-1 overflow-auto p-3 whitespace-pre-wrap leading-relaxed font-(family-name:--font-mono)">
            {running && <div className="text-neutral-500">Executing Python process…</div>}

            {!running && !result && (
              <div className="text-neutral-600 font-(family-name:--font-ui)">
                Run code to see stdout, stderr, and terminal outputs here.
              </div>
            )}

            {!running && result?.error && (
              <div className="text-rose-400 bg-rose-950/20 border border-rose-900/40 p-2.5 rounded">
                {result.error}
              </div>
            )}

            {!running && result && !result.error && (
              <>
                {result.compileStderr && (
                  <div className="text-yellow-400 mb-2 font-mono">{result.compileStderr}</div>
                )}
                {result.stdout && <div className="text-neutral-100">{result.stdout}</div>}
                {result.stderr && (
                  <div className="text-rose-400 mt-2 font-mono bg-rose-950/20 border border-rose-900/30 p-2 rounded">
                    {result.stderr}
                  </div>
                )}
                {result.status === "timeout" && (
                  <div className="text-rose-400 mt-2">
                    Execution timed out after {result.time ? `${Math.round(Number(result.time))} seconds.` : "timeout limit."}
                  </div>
                )}
                {!result.stdout && !result.stderr && !result.compileStderr && (
                  <div className="text-neutral-500 font-(family-name:--font-ui)">
                    (Process exited with code {result.exitCode} — no output printed to stdout)
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab Content: Challenge Feedback ── */}
      {activeTab === "validation" && result?.validation && (
        <div className="flex-1 overflow-auto p-3 space-y-3 font-(family-name:--font-ui)">
          {/* Banner Status Card */}
          <div
            className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
              valStatus === "passed"
                ? "bg-emerald-950/25 border-emerald-500/30 text-emerald-100"
                : valStatus === "failed"
                  ? "bg-amber-950/25 border-amber-500/30 text-amber-100"
                  : "bg-rose-950/25 border-rose-500/30 text-rose-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {valStatus === "passed" ? "🎯" : valStatus === "failed" ? "💡" : "⚠️"}
                </span>
                <h4 className="font-semibold text-[13px]">{result.validation.title}</h4>
              </div>

              {result.validation.points !== undefined && (
                <div className="flex items-baseline gap-1 bg-black/40 px-2.5 py-1 rounded-md border border-white/10">
                  <span className="text-sm font-bold text-emerald-400">
                    {result.validation.points}
                  </span>
                  <span className="text-[10px] text-neutral-400">/ 1000 pts</span>
                </div>
              )}
            </div>

            <p className="text-[12px] opacity-90 leading-relaxed">{result.validation.message}</p>

            {result.validation.errorPct !== undefined && (
              <div className="text-[11px] font-mono text-neutral-300 pt-1 border-t border-white/10 flex items-center justify-between">
                <span>Validation Error Metric:</span>
                <span className="font-semibold text-emerald-300">{result.validation.errorPct}%</span>
              </div>
            )}
          </div>

          {/* Validation Checklist */}
          {result.validation.checks && result.validation.checks.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h5 className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-2">
                Validation Criteria
              </h5>
              <div className="space-y-1.5">
                {result.validation.checks.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-[12px]">
                    <span className={`shrink-0 mt-0.5 text-[12px] ${c.passed ? "text-emerald-400" : "text-amber-400"}`}>
                      {c.passed ? "✓" : "✗"}
                    </span>
                    <span className={c.passed ? "text-neutral-200" : "text-neutral-300"}>
                      {c.label}
                      {c.message && (
                        <span className="block text-[11px] text-neutral-400 font-mono">
                          {c.message}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contextual Hints */}
          {result.validation.hints && result.validation.hints.length > 0 && (
            <div className="rounded-lg border border-sky-500/20 bg-sky-950/15 p-3">
              <h5 className="text-[11px] uppercase tracking-wider text-sky-400 font-semibold mb-1.5 flex items-center gap-1.5">
                <span>💡</span> Contextual Feedback & Hints
              </h5>
              <ul className="space-y-1.5 list-disc pl-4 text-[12px] text-neutral-200">
                {result.validation.hints.map((hint, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Plots Preview ── */}
      {activeTab === "plots" && result?.image && (
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-2 font-(family-name:--font-ui)">
          <div className="flex items-center justify-between text-[11.5px] text-neutral-400 border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 font-medium text-[#4ec9b0]">
              <span>📊</span> Visualization Output (Matplotlib / Seaborn)
            </span>
            <a
              href={result.image}
              download="visualization.png"
              className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Download PNG
            </a>
          </div>
          <div className="flex-1 flex items-center justify-center p-2 bg-black/40 rounded-lg border border-white/5">
            <img
              src={result.image}
              alt="Generated Matplotlib / Seaborn visualization"
              className="rounded border border-white/10 object-contain max-h-[360px] bg-[#181818]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

