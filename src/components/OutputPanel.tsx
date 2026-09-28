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
  onOpenVictoryModal?: () => void;
}

export default function OutputPanel({
  running,
  result,
  stdin,
  onStdinChange,
  defaultTab = "console",
  onOpenVictoryModal,
}: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState<"console" | "validation" | "plots">(defaultTab);

  // Auto-switch to validation tab when fresh validation feedback arrives, or plots if only image arrives
  useEffect(() => {
    if (result?.validation) {
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
    ? { dot: "bg-[#c5a059]", label: "Executing…" }
    : result?.error || (result && result.exitCode !== 0)
      ? { dot: "bg-[#c81d25]", label: `Exit ${result?.exitCode ?? "ERR"}` }
      : result
        ? { dot: "bg-emerald-500", label: "Exit 0" }
        : { dot: "bg-neutral-600", label: "Standby" };

  const valStatus = result?.validation?.status;

  return (
    <div className="h-full flex flex-col bg-[#0d0d10] text-neutral-200 font-(family-name:--font-mono) text-[12.5px] border-l border-white/10">
      {/* ── Panel Header / Tabs ── */}
      <div className="flex items-center justify-between px-2 h-9 border-b border-white/10 bg-[#111115] shrink-0 font-(family-name:--font-ui) text-[11.5px] select-none">
        <div className="flex items-center gap-1 h-full">
          {/* Mission Console Tab */}
          <button
            onClick={() => setActiveTab("console")}
            className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-colors ${
              activeTab === "console"
                ? "border-[#c81d25] text-white font-medium bg-white/[0.02]"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className="tracking-wide">Mission Console</span>
          </button>

          {/* Mission Verification Tab */}
          {hasValidation && (
            <button
              onClick={() => setActiveTab("validation")}
              className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-colors ${
                activeTab === "validation"
                  ? "border-[#c5a059] text-[#c5a059] font-medium bg-white/[0.02]"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="tracking-wide">Verification</span>
              {valStatus === "passed" && (
                <span className="px-1.5 py-0.2 bg-[#c5a059]/15 text-[#c5a059] border border-[#c5a059]/30 rounded text-[9.5px] font-bold">
                  {result?.validation?.points ?? 0} pts
                </span>
              )}
              {valStatus === "failed" && (
                <span className="px-1.5 py-0.2 bg-[#c81d25]/15 text-[#ea3943] border border-[#c81d25]/30 rounded text-[9.5px] font-medium">
                  Alert
                </span>
              )}
              {valStatus === "error" && (
                <span className="px-1.5 py-0.2 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded text-[9.5px] font-medium">
                  Error
                </span>
              )}
            </button>
          )}

          {/* Recon Visuals Tab */}
          {hasImage && (
            <button
              onClick={() => setActiveTab("plots")}
              className={`flex items-center gap-1.5 px-3 h-full border-b-2 transition-colors ${
                activeTab === "plots"
                  ? "border-[#c5a059] text-[#c5a059] font-medium bg-white/[0.02]"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <svg className="w-3.5 h-3.5 text-[#c5a059]" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z" />
              </svg>
              <span className="tracking-wide">Visuals</span>
            </button>
          )}
        </div>

        {/* Header Right Status */}
        <div className="flex items-center gap-2 pr-1 text-[11px] text-neutral-400 font-(family-name:--font-mono)">
          {result?.time && <span className="text-neutral-300">{result.time}s</span>}
          <span className="text-neutral-500 font-medium uppercase text-[10px]">{status.label}</span>
        </div>
      </div>

      {/* ── Tab Content: Mission Console ── */}
      {activeTab === "console" && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Stdin box */}
          <div className="border-b border-white/5 p-2 shrink-0 bg-[#0e0e12]">
            <label className="block text-[9.5px] uppercase tracking-wider text-[#c5a059] mb-1 font-(family-name:--font-ui) font-semibold">
              Console Input Stream (STDIN)
            </label>
            <textarea
              value={stdin}
              onChange={(event) => onStdinChange(event.target.value)}
              placeholder="Input passed to script..."
              rows={2}
              className="w-full resize-y rounded border border-white/10 bg-[#0a0a0d] px-2.5 py-1.5 text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-[#c81d25] text-[11.5px]"
            />
          </div>

          {/* Console stdout / stderr streams */}
          <div className="flex-1 overflow-auto p-3 whitespace-pre-wrap leading-relaxed font-(family-name:--font-mono) bg-[#0a0a0d]">
            {running && (
              <div className="text-neutral-400 flex items-center gap-2">
                <span className="animate-spin text-sm">⚙️</span>
                <span>Executing Python script & telemetry simulation…</span>
              </div>
            )}

            {!running && !result && (
              <div className="text-neutral-500 font-(family-name:--font-ui) text-xs">
                Press "Execute Heist" to run the operation blueprint and view output streams.
              </div>
            )}

            {!running && result?.error && (
              <div className="text-rose-300 bg-rose-950/20 border border-rose-900/40 p-2.5 rounded text-xs">
                {result.error}
              </div>
            )}

            {!running && result && !result.error && (
              <>
                {result.compileStderr && (
                  <div className="text-amber-300 mb-2 font-mono bg-amber-950/20 p-2 rounded border border-amber-800/40 text-xs">
                    {result.compileStderr}
                  </div>
                )}
                {result.stdout && <div className="text-neutral-200">{result.stdout}</div>}
                {result.stderr && (
                  <div className="text-rose-400 mt-2 font-mono bg-rose-950/20 border border-rose-900/40 p-2 rounded text-xs">
                    {result.stderr}
                  </div>
                )}
                {result.status === "timeout" && (
                  <div className="text-rose-400 mt-2 bg-rose-950/30 p-2 rounded border border-rose-800/60 text-xs">
                    Execution timed out after {result.time ? `${Math.round(Number(result.time))} seconds.` : "timeout limit."}
                  </div>
                )}
                {!result.stdout && !result.stderr && !result.compileStderr && (
                  <div className="text-neutral-500 font-(family-name:--font-ui) text-xs">
                    (Process completed with exit code {result.exitCode} — no output printed to STDOUT)
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab Content: Mission Verification ── */}
      {activeTab === "validation" && result?.validation && (
        <div className="flex-1 overflow-auto p-3 space-y-3 font-(family-name:--font-ui) bg-[#0a0a0d]">
          {/* Banner Status Card */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2.5 ${
              valStatus === "passed"
                ? "bg-[#0d1611] border-[#225534] text-neutral-100"
                : valStatus === "failed"
                  ? "bg-[#180f11] border-[#551a1e] text-neutral-100"
                  : "bg-rose-950/20 border-rose-500/30 text-rose-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {valStatus === "passed" ? "🔓" : valStatus === "failed" ? "🚨" : "⚠️"}
                </span>
                <div>
                  <div className="text-[9px] font-mono tracking-wider uppercase font-bold text-[#c5a059]">
                    {valStatus === "passed" ? "MISSION STATUS: CLEARED" : "MISSION STATUS: INCOMPLETE"}
                  </div>
                  <h4 className="font-semibold text-[13.5px] text-white">{result.validation.title}</h4>
                </div>
              </div>

              {result.validation.points !== undefined && (
                <div className="flex items-baseline gap-1 bg-black/40 px-2.5 py-1 rounded border border-white/10">
                  <span className="text-sm font-bold text-[#c5a059]">
                    {result.validation.points}
                  </span>
                  <span className="text-[9.5px] text-neutral-400 font-mono">/ 1000 pts</span>
                </div>
              )}
            </div>

            <p className="text-[12px] opacity-90 leading-relaxed text-neutral-300">
              {result.validation.message}
            </p>

            {result.validation.errorPct !== undefined && (
              <div className="text-[11px] font-mono text-neutral-300 pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-neutral-400">Relative Absolute Error:</span>
                <span className="font-semibold text-emerald-400">{result.validation.errorPct}%</span>
              </div>
            )}

            {valStatus === "passed" && onOpenVictoryModal && (
              <div className="pt-1.5">
                <button
                  onClick={onOpenVictoryModal}
                  className="w-full py-1.5 bg-[#c5a059] hover:bg-[#d8b26e] text-black rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>🏛️</span>
                  <span>View Vault Completion Screen</span>
                </button>
              </div>
            )}
          </div>

          {/* Validation Checklist */}
          {result.validation.checks && result.validation.checks.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#111115] p-3.5">
              <h5 className="text-[10px] uppercase tracking-wider text-[#c5a059] font-semibold mb-2.5 flex items-center gap-1.5">
                <span>🛡️</span> Security Clearance Verification
              </h5>
              <div className="space-y-2">
                {result.validation.checks.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 text-[12px]">
                    <span
                      className={`shrink-0 mt-0.5 text-[12px] font-bold ${
                        c.passed ? "text-emerald-400" : "text-[#c81d25]"
                      }`}
                    >
                      {c.passed ? "✓" : "✗"}
                    </span>
                    <span className={c.passed ? "text-neutral-200" : "text-neutral-300"}>
                      <span className="font-medium">{c.label}</span>
                      {c.message && (
                        <span className="block text-[11px] text-neutral-400 font-mono mt-0.5">
                          {c.message}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contextual Hints / Professor's Intel */}
          {result.validation.hints && result.validation.hints.length > 0 && (
            <div className="rounded-xl border border-[#c5a059]/30 bg-[#121217] p-3.5">
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/5">
                <span className="text-sm">👓</span>
                <div>
                  <h5 className="text-[11px] uppercase tracking-wider text-[#c5a059] font-semibold leading-none">
                    Professor's Intel // Tactical Intercept
                  </h5>
                  <span className="text-[9px] text-neutral-500 font-mono">Encrypted Priority Channel</span>
                </div>
              </div>
              <ul className="space-y-1.5 text-[12px] text-neutral-200">
                {result.validation.hints.map((hint, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-[#c5a059] shrink-0 mt-0.5 font-bold">›</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Recon Visuals ── */}
      {activeTab === "plots" && result?.image && (
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-2 font-(family-name:--font-ui) bg-[#0a0a0d]">
          <div className="flex items-center justify-between text-[11.5px] text-neutral-400 border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 font-medium text-[#c5a059]">
              <span>📊</span> Reconnaissance Visual Telemetry
            </span>
            <a
              href={result.image}
              download="visualization.png"
              className="text-[11px] px-2.5 py-1 rounded bg-[#c5a059]/15 border border-[#c5a059]/30 hover:bg-[#c5a059]/30 text-[#c5a059] font-medium transition-colors"
            >
              Download PNG
            </a>
          </div>
          <div className="flex-1 flex items-center justify-center p-3 bg-[#111115] rounded-xl border border-white/5">
            <img
              src={result.image}
              alt="Generated ML Reconnaissance visualization"
              className="rounded-lg border border-white/10 object-contain max-h-[360px] bg-[#0d0d10]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
