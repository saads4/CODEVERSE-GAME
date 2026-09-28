"use client";

import { useEffect, useState } from "react";
import { heistAudio } from "@/lib/audio";

interface MissionBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MissionBriefingModal({ isOpen, onClose }: MissionBriefingModalProps) {
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  useEffect(() => {
    if (isOpen) {
      heistAudio.play("missionStart");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnter = () => {
    setHasAcknowledged(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-vault-open">
      <div className="relative w-full max-w-2xl bg-[#0e0e13] border border-white/10 rounded-xl overflow-hidden flex flex-col text-neutral-200">
        {/* Top Classified Bar */}
        <div className="h-11 bg-[#14141a] border-b border-white/10 px-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎭</span>
            <span className="font-semibold tracking-wider text-[12.5px] uppercase">
              PLAN DEL PROFESOR // CLASSIFIED MISSION DOSSIER
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="stamp-classified text-[9.5px]">
              EYES ONLY
            </span>
            <button
              onClick={handleEnter}
              className="text-neutral-400 hover:text-white text-base font-bold p-1 leading-none transition-colors"
              title="Close Briefing"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dossier Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto font-(family-name:--font-ui)">
          {/* Header & Stamp */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <span className="text-[10px] font-mono tracking-wider text-[#c5a059] uppercase font-semibold">
                OPERATION TARGET:
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white uppercase">
                LA REAL CASA DE LA MONEDA // PRINTING PRESS YIELD
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Authorized by: <strong className="text-neutral-200 font-medium">El Profesor</strong> — Status: <span className="text-emerald-400 font-medium">ACTIVE</span>
              </p>
            </div>
            <div className="shrink-0">
              <span className="stamp-classified">TOP SECRET</span>
            </div>
          </div>

          {/* Professor's Voice / Directive */}
          <div className="bg-[#121217] border-l-2 border-[#c81d25] p-3.5 rounded-r-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">👓</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#c5a059]">
                Directive from El Profesor
              </span>
            </div>
            <p className="text-[12.5px] text-neutral-300 leading-relaxed italic">
              "Every second the Royal Mint presses run, millions of Euros are printed. To secure the vault, we must predict the exact currency yield from the machines before the authorities catch on. Build and train your ML regression model to crack the pattern."
            </p>
          </div>

          {/* Mission Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Objective & Datasets */}
            <div className="bg-[#111115] border border-white/10 rounded-lg p-3.5 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c5a059] flex items-center gap-1.5">
                <span>📁</span> Intelligence & Datasets
              </h3>
              <ul className="text-xs space-y-2 text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#c81d25] font-bold">1.</span>
                  <span>
                    <strong className="text-white font-mono">train.csv:</strong> Historical telemetry containing printing speed, temperature, machine age, shift, and target <code className="text-[#c5a059] font-mono">amount_printed</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#c81d25] font-bold">2.</span>
                  <span>
                    <strong className="text-white font-mono">test.csv:</strong> 1,500 operational test cases to forecast without labels.
                  </span>
                </li>
              </ul>
            </div>

            {/* Operational Constraints & Rules */}
            <div className="bg-[#111115] border border-white/10 rounded-lg p-3.5 space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <span>⚠️</span> Mission Constraints
              </h3>
              <ul className="text-xs space-y-2 text-neutral-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#c5a059] font-bold">✦</span>
                  <span>
                    Assign exactly 1,500 numeric predictions to global variable <code className="text-[#c5a059] font-mono">predictions</code>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#c5a059] font-bold">✦</span>
                  <span>
                    Handle missing values (<code className="text-neutral-400 font-mono">NaN / Inf</code>) before assigning predictions.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#c5a059] font-bold">✦</span>
                  <span>
                    Optional: Save diagnostic plots using <code className="text-neutral-400 font-mono">plt.savefig("visualization.png")</code>.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* 3-Phase Execution Roadmap */}
          <div className="bg-[#111115] border border-white/10 rounded-lg p-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-2.5 flex items-center gap-1.5">
              <span>🏛️</span> Vault Breach Sequence
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded bg-black/30 border border-white/5">
                <div className="text-[9.5px] font-mono font-semibold text-neutral-400 uppercase">Stage 01</div>
                <div className="font-medium text-white mt-0.5">Reconnaissance</div>
                <p className="text-[11px] text-neutral-400 mt-0.5">Load datasets & inspect distributions.</p>
              </div>
              <div className="p-2.5 rounded bg-black/30 border border-white/5">
                <div className="text-[9.5px] font-mono font-semibold text-neutral-400 uppercase">Stage 02</div>
                <div className="font-medium text-white mt-0.5">Infiltration</div>
                <p className="text-[11px] text-neutral-400 mt-0.5">Feature engineering & shape 1,500 targets.</p>
              </div>
              <div className="p-2.5 rounded bg-[#c5a059]/10 border border-[#c5a059]/30">
                <div className="text-[9.5px] font-mono font-semibold text-[#c5a059] uppercase">Stage 03</div>
                <div className="font-medium text-[#c5a059] mt-0.5">Vault Breach</div>
                <p className="text-[11px] text-neutral-300 mt-0.5">Train regression model to clear 1,000 pts.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-[#0a0a0d] border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            {hasAcknowledged ? "Dossier reviewable at any time." : "Review requirements before executing blueprint."}
          </span>
          <button
            onClick={handleEnter}
            className="flex items-center gap-2 bg-[#c81d25] hover:bg-[#db2831] text-white px-4 py-2 rounded-lg font-semibold text-xs tracking-wider uppercase transition-colors"
          >
            <span>🎭</span>
            <span>Enter Control Room</span>
          </button>
        </div>
      </div>
    </div>
  );
}
