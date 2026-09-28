"use client";

import type { ValidationFeedback } from "@/app/api/printing-press/run/route";

interface VaultProgressBarProps {
  validation: ValidationFeedback | null | undefined;
  running: boolean;
}

export interface MissionPhase {
  id: string;
  name: string;
  code: string;
  description: string;
  cleared: boolean;
  active: boolean;
}

export default function VaultProgressBar({ validation, running }: VaultProgressBarProps) {
  // Determine clearance of the 3 phases based on validation criteria
  const checks = validation?.checks ?? [];
  const execCheck = checks.find((c) => c.id === "exec")?.passed ?? false;
  const varCheck = checks.find((c) => c.id === "var")?.passed ?? false;
  const lenCheck = checks.find((c) => c.id === "len")?.passed ?? false;
  const validCheck = checks.find((c) => c.id === "valid")?.passed ?? false;
  const scoreCheck = checks.find((c) => c.id === "score")?.passed ?? false;

  // Stage 1: Reconnaissance (Script executed and predictions variable exists)
  const stage1Cleared = execCheck && varCheck;

  // Stage 2: Infiltration (Output shape matches 1500 and values are valid numbers)
  const stage2Cleared = stage1Cleared && lenCheck && validCheck;

  // Stage 3: Vault Breach (Validation score achieved / error within benchmark)
  const stage3Cleared = stage2Cleared && scoreCheck && (validation?.status === "passed");

  const phases: MissionPhase[] = [
    {
      id: "recon",
      name: "Reconnaissance",
      code: "STAGE 01",
      description: "Data Ingestion & Blueprint",
      cleared: stage1Cleared,
      active: !stage1Cleared,
    },
    {
      id: "infiltrate",
      name: "Infiltration",
      code: "STAGE 02",
      description: "Feature Prep & 1,500 Targets",
      cleared: stage2Cleared,
      active: stage1Cleared && !stage2Cleared,
    },
    {
      id: "breach",
      name: "Vault Breach",
      code: "STAGE 03",
      description: "ML Model Convergence & Unlock",
      cleared: stage3Cleared,
      active: stage2Cleared && !stage3Cleared,
    },
  ];

  const totalCleared = [stage1Cleared, stage2Cleared, stage3Cleared].filter(Boolean).length;
  const progressPct = totalCleared === 3 ? 100 : totalCleared === 2 ? 66 : totalCleared === 1 ? 33 : 0;

  return (
    <div className="flex items-center gap-2.5 px-3 py-1 bg-[#121216] border border-white/10 rounded-lg">
      {/* Vault Status Indicator */}
      <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-white/10">
        <div className={`w-5 h-5 flex items-center justify-center rounded-full border text-[11px] ${
          stage3Cleared 
            ? "border-[#c5a059] bg-[#c5a059]/15 text-[#c5a059]" 
            : running
            ? "border-[#c81d25] bg-[#c81d25]/15 text-[#c81d25]"
            : "border-white/15 bg-white/5 text-neutral-500"
        }`}>
          {stage3Cleared ? "🔓" : "🔒"}
        </div>
        <div className="flex flex-col">
          <span className="text-[8.5px] font-mono tracking-widest text-[#c5a059] uppercase font-bold leading-none">
            VAULT
          </span>
          <span className="text-[10px] font-medium tracking-wide text-neutral-300 leading-tight">
            {stage3Cleared ? "100% UNLOCKED" : `${progressPct}% CLEARED`}
          </span>
        </div>
      </div>

      {/* Progress Bars / Tumblers */}
      <div className="flex items-center gap-1.5">
        {phases.map((phase, idx) => (
          <div key={phase.id} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
                phase.cleared
                  ? "border-[#c5a059]/40 bg-[#c5a059]/10 text-[#c5a059]"
                  : phase.active && running
                  ? "border-[#c81d25]/60 bg-[#c81d25]/10 text-neutral-200"
                  : "border-white/5 bg-white/[0.02] text-neutral-500"
              }`}
            >
              {/* Tumbler Pin */}
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                phase.cleared 
                  ? "bg-[#c5a059]" 
                  : phase.active && running 
                  ? "bg-[#c81d25]" 
                  : "bg-neutral-700"
              }`} />
              <div className="flex items-center gap-1">
                <span className="text-[8.5px] font-mono leading-none tracking-wider opacity-75">
                  {phase.code}
                </span>
                <span className="text-[10px] font-medium tracking-tight leading-tight hidden lg:inline">
                  {phase.name}
                </span>
              </div>
            </div>

            {idx < phases.length - 1 && (
              <span className="text-[9px] text-neutral-600">
                ›
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
