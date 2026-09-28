"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Editor from "@/components/Editor";
import OutputPanel, { type RunResult } from "@/components/OutputPanel";
import VaultProgressBar from "@/components/VaultProgressBar";
import MissionBriefingModal from "@/components/MissionBriefingModal";
import VaultSuccessModal from "@/components/VaultSuccessModal";
import AudioControls from "@/components/AudioControls";
import { IconBack, IconPlay } from "@/components/icons";
import { heistAudio } from "@/lib/audio";

// ── Icons & Badges ───────────────────────────────────────────────────────────

function TrafficLights() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
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
      <text x="2.5" y="13" fontSize="4.5" fontFamily="monospace" fill="#c5a059" fontWeight="bold">CSV</text>
    </svg>
  );
}

function IconPython({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1C4.686 1 4 2.546 4 4v1h4v.5H2.5C1.12 5.5 0 6.62 0 8s1.12 2.5 2.5 2.5H4V12c0 1.657 1.343 3 3 3h2c1.657 0 3-1.343 3-3v-1H8v-.5h5.5c1.38 0 2.5-1.12 2.5-2.5S14.88 5.5 13.5 5.5H12V4c0-1.657-1.343-3-3-3H8z" fill="#c81d25" />
      <circle cx="5.5" cy="3.5" r="0.75" fill="white" />
      <circle cx="10.5" cy="12.5" r="0.75" fill="white" />
    </svg>
  );
}

// ── Starter Code ─────────────────────────────────────────────────────────────

const CODE_MAIN = `import pandas as pd
import numpy as np

# ── PLAN DEL PROFESOR: ML HEIST CONTROL ROOM ─────────────────
# Datasets are ready in your workspace for model training:
train_df = pd.read_csv("train.csv")
test_df  = pd.read_csv("test.csv")

# ── Mission Instructions ─────────────────────────────────────
# 1. Preprocess train_df features & target ('amount_printed')
# 2. Train your ML regression model (e.g., HistGradientBoostingRegressor,
#    RandomForestRegressor, XGBoost, or Ridge regression)
# 3. Generate predictions for test_df
# 4. Assign predictions to 'predictions' (len == 1500)
#
# (Optional) You can save visual telemetry plots:
# import matplotlib.pyplot as plt
# plt.savefig("visualization.png")
#
# predictions = ...

# ── Write Your Model Below ───────────────────────────────────

predictions = ...
`;

// ── File Tree Structure with Themed Labels ────────────────────────────────────

type FileEntry = {
  name: string;
  themedLabel: string;
  tag: string;
  readOnly?: boolean;
};

const FILES: FileEntry[] = [
  {
    name: "main.py",
    themedLabel: "main.py",
    tag: "OPERATION BLUEPRINT",
    readOnly: false,
  },
  {
    name: "train.csv",
    themedLabel: "train.csv",
    tag: "ROYAL MINT DATA",
    readOnly: true,
  },
  {
    name: "test.csv",
    themedLabel: "test.csv",
    tag: "VAULT SENSORS",
    readOnly: true,
  },
];

function ThemedFileTree({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <aside className="w-[230px] shrink-0 bg-[#0d0d10] border-r border-white/10 flex flex-col text-[12.5px] select-none overflow-y-auto">
      {/* Explorer header */}
      <div className="h-9 px-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#c5a059] border-b border-white/5 bg-[#111115]">
        <span className="flex items-center gap-1.5">
          <span>📁</span>
          <span>Classified Files</span>
        </span>
        <span className="text-[9px] font-mono font-medium text-[#c81d25] bg-[#c81d25]/10 px-1.5 py-0.5 rounded border border-[#c81d25]/20">
          RESTRICTED
        </span>
      </div>

      {/* Project folder */}
      <button
        className="flex items-center gap-1.5 w-full px-2.5 py-2 text-neutral-300 hover:bg-white/5 transition-colors border-b border-white/5"
        onClick={() => setOpen((v) => !v)}
      >
        <IconChevron open={open} className="w-3.5 h-3.5 text-[#c5a059]" />
        <span className="font-semibold text-[11.5px] uppercase tracking-wide truncate text-[#c5a059]">
          OPERACIÓN LA MONEDA
        </span>
      </button>

      {open && (
        <ul className="p-1.5 space-y-0.5">
          {FILES.map((f) => {
            const isActive = selected === f.name;
            const isCsv = f.name.endsWith(".csv");
            return (
              <li key={f.name}>
                <button
                  onClick={() => onSelect(f.name)}
                  className={`flex flex-col gap-0.5 w-full px-2.5 py-1.5 rounded text-left truncate transition-colors border ${
                    isActive
                      ? "bg-[#c81d25]/10 border-[#c81d25]/40 text-white"
                      : "border-transparent text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isCsv ? (
                      <IconCSV className="w-3.5 h-3.5 shrink-0 text-[#c5a059]" />
                    ) : (
                      <IconPython className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="font-medium text-[12px] truncate">{f.name}</span>
                    {f.readOnly && (
                      <span className="ml-auto text-[9px] text-neutral-500 font-mono shrink-0">
                        [LOCK]
                      </span>
                    )}
                  </div>
                  <div className="pl-5 text-[9px] font-mono tracking-wider uppercase text-[#c5a059]/80 truncate">
                    {f.tag}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dossier footer directive */}
      <div className="mt-auto p-2.5 border-t border-white/5 bg-[#0a0a0d]">
        <div className="p-2 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-[9px] font-mono uppercase text-[#c5a059] font-semibold">
            MISSION DIRECTIVE
          </span>
          <span className="text-[10px] text-neutral-400 leading-tight">
            Crack the 1,500 target print quantities to bypass vault defenses.
          </span>
        </div>
      </div>
    </aside>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function PrintingPressPage() {
  const [selectedFile, setSelectedFile] = useState("main.py");
  const [fileContents, setFileContents] = useState<Record<string, string>>({
    "main.py": CODE_MAIN,
  });

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  // Modals state
  const [showBriefing, setShowBriefing] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [hasAutoOpenedBriefing, setHasAutoOpenedBriefing] = useState(false);

  // Auto-open briefing once on initial mount
  useEffect(() => {
    if (!hasAutoOpenedBriefing) {
      setShowBriefing(true);
      setHasAutoOpenedBriefing(true);
    }
  }, [hasAutoOpenedBriefing]);

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
    ? `# ─────────────────────────────────────────────────────────────
# ${selectedFile} // CLASSIFIED TELEMETRY DATASET [READ-ONLY]
# ─────────────────────────────────────────────────────────────
# Load this data directly into your operation blueprint with:
import pandas as pd
df = pd.read_csv("${selectedFile}")

# Telemetry features include:
# - printing_speed, machine_age, operating_hours, temperature,
# - humidity, power_stability, setup_time, paper_type, shift,
# - maintenance_status, machine_type, paper_quality, operator_id, etc.`
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
        heistAudio.play("validationFailure");
      } else {
        setResult(data);

        // Check if validation passed or failed for audio & victory triggers
        if (data.validation?.status === "passed") {
          setShowVictory(true);
        } else if (data.validation?.status === "failed" || data.validation?.status === "error") {
          heistAudio.play("validationFailure");
        }
      }
    } catch (error) {
      setResult({
        stdout: "",
        stderr: "",
        exitCode: -1,
        error: error instanceof Error ? error.message : "Execution failed",
      });
      heistAudio.play("validationFailure");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="h-screen flex flex-col bg-[#0a0a0d] text-neutral-200 select-none">
      {/* ── Top Toolbar / Control Room Header ── */}
      <header className="h-11 flex items-center justify-between px-3 border-b border-white/10 bg-[#111115] shrink-0 gap-3">
        {/* Left: Traffic lights & Navigation */}
        <div className="flex items-center gap-3 shrink-0">
          <TrafficLights />
          <Link
            href="/"
            title="Return to Operations Hub"
            aria-label="Return to Operations Hub"
            className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
          >
            <IconBack className="w-3.5 h-3.5" />
          </Link>
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="text-sm">🎭</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold tracking-wider text-white uppercase leading-tight">
                PLAN DEL PROFESOR
              </span>
              <span className="text-[8.5px] font-mono tracking-widest text-[#c5a059] leading-none">
                ML HEIST CONTROL ROOM
              </span>
            </div>
          </div>
        </div>

        {/* Center: Vault Progress Tumbler */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-xl">
          <VaultProgressBar validation={result?.validation} running={running} />
        </div>

        {/* Right: Controls, Briefing & Execute Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Audio Controls */}
          <AudioControls />

          {/* Mission Briefing Button */}
          <button
            onClick={() => setShowBriefing(true)}
            title="Open Classified Mission Briefing"
            className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-[#18181f] hover:bg-[#202028] border border-[#c5a059]/40 text-[#c5a059] text-[11.5px] font-medium tracking-wide transition-colors"
          >
            <span>📜</span>
            <span className="hidden sm:inline">Briefing</span>
          </button>

          {/* Execute Heist Button */}
          <button
            onClick={runCode}
            disabled={running || isReadOnly}
            title={isReadOnly ? "Select blueprint main.py to execute heist" : "Execute ML Heist & Validate Model"}
            className="flex items-center gap-1.5 bg-[#c81d25] hover:bg-[#db2831] disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-[12px] font-semibold tracking-wider uppercase h-7 px-3.5 rounded-md transition-colors"
          >
            {running ? (
              <>
                <span className="animate-spin text-xs">⚙️</span>
                <span>Executing…</span>
              </>
            ) : (
              <>
                <IconPlay className="w-3 h-3 text-white" />
                <span>Execute Heist</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Body: File Tree + Code Editor + Output Panel ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* File tree sidebar */}
        <ThemedFileTree selected={selectedFile} onSelect={setSelectedFile} />

        {/* Code Editor */}
        <section className="flex-1 min-w-0 flex flex-col bg-[#0e0f12]">
          {/* Tab bar */}
          <div className="h-[34px] flex items-center border-b border-white/10 bg-[#111115] px-2 shrink-0 overflow-x-auto justify-between">
            <div className="flex items-center gap-1 h-full">
              <div className="flex items-center gap-1.5 px-3 h-full border-b-2 border-[#c81d25] text-white text-[12px] font-medium bg-white/[0.02]">
                {selectedFile.endsWith(".csv") ? (
                  <IconCSV className="w-3.5 h-3.5 text-[#c5a059]" />
                ) : (
                  <IconPython className="w-3.5 h-3.5" />
                )}
                <span>{selectedFile}</span>
                {isReadOnly && (
                  <span className="ml-1 text-[9px] text-[#c5a059] font-mono">[LOCKED]</span>
                )}
              </div>
            </div>

            <div className="text-[10px] font-mono text-neutral-500 pr-2">
              PYTHON 3 // MONACO
            </div>
          </div>

          <Editor
            filename={selectedFile}
            value={editorValue}
            onChange={isReadOnly ? () => {} : updateCurrentCode}
          />
        </section>

        {/* Output Panel (Mission Console & Mission Verification) */}
        <section className="w-[440px] shrink-0 flex flex-col min-h-0">
          <OutputPanel
            running={running}
            result={result}
            stdin=""
            onStdinChange={() => {}}
            onOpenVictoryModal={() => setShowVictory(true)}
          />
        </section>
      </div>

      {/* ── Modals ── */}
      <MissionBriefingModal
        isOpen={showBriefing}
        onClose={() => setShowBriefing(false)}
      />

      {result?.validation && (
        <VaultSuccessModal
          isOpen={showVictory}
          onClose={() => setShowVictory(false)}
          validation={result.validation}
          imageUrl={result.image}
        />
      )}
    </main>
  );
}
