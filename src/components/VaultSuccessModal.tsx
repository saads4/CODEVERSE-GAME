"use client";

import { useEffect } from "react";
import type { ValidationFeedback } from "@/app/api/printing-press/run/route";
import { heistAudio } from "@/lib/audio";

interface VaultSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: ValidationFeedback;
  imageUrl?: string | null;
}

export default function VaultSuccessModal({
  isOpen,
  onClose,
  validation,
  imageUrl,
}: VaultSuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      heistAudio.play("vaultUnlock");
      setTimeout(() => {
        heistAudio.play("validationSuccess");
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const points = validation.points ?? 0;
  const isTopTier = points >= 950;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto animate-vault-open">
      <div className="relative w-full max-w-xl bg-[#0e0e13] border border-[#c5a059]/40 rounded-xl overflow-hidden flex flex-col text-neutral-200">
        {/* Header Bar */}
        <div className="h-11 bg-[#15151c] border-b border-white/10 px-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏛️</span>
            <span className="font-semibold tracking-wider text-[12.5px] uppercase text-[#c5a059]">
              HEIST SUCCESSFUL // VAULT BREACH CONFIRMED
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-base font-bold p-1 leading-none transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 text-center font-(family-name:--font-ui)">
          {/* Understated Vault Unlock Badge */}
          <div className="flex flex-col items-center justify-center my-1">
            <div className="w-14 h-14 rounded-full border border-[#c5a059]/60 bg-[#c5a059]/10 flex items-center justify-center text-2xl mb-2">
              🔓
            </div>
            <span className="stamp-gold text-[10px]">OPERATION COMPLETED // BELLA CIAO</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white uppercase">
              The Royal Mint Vault Is Open
            </h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1.5 leading-relaxed">
              Your machine learning model successfully predicted the currency yields within the required operational threshold.
            </p>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            <div className="bg-[#121217] border border-white/10 rounded-lg p-3 flex flex-col items-center">
              <span className="text-[10px] font-mono uppercase text-[#c5a059] font-medium">
                BOUNTY POINTS
              </span>
              <span className="text-xl font-bold text-[#c5a059] mt-0.5">
                {points} <span className="text-xs text-neutral-500 font-normal">/ 1000</span>
              </span>
            </div>

            <div className="bg-[#121217] border border-white/10 rounded-lg p-3 flex flex-col items-center">
              <span className="text-[10px] font-mono uppercase text-emerald-400 font-medium">
                MODEL ERROR
              </span>
              <span className="text-xl font-bold text-emerald-400 mt-0.5">
                {validation.errorPct !== undefined ? `${validation.errorPct}%` : "0.0%"}
              </span>
            </div>
          </div>

          {/* Professor's Commendation */}
          <div className="bg-[#121217] border-l-2 border-[#c5a059] p-3.5 rounded-r-lg text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">👓</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#c5a059]">
                El Profesor
              </span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed italic">
              {isTopTier
                ? "“Brilliant execution. Not even the Governor of the Bank could predict numbers with this precision. Pack the bags — we have what we came for.”"
                : "“The vault door is open and the operation is a success! You can continue refining your feature engineering and hyperparameters to reach the highest 1,000 pt benchmark.”"}
            </p>
          </div>

          {/* Visualization preview if available */}
          {imageUrl && (
            <div className="bg-[#111115] border border-white/10 rounded-lg p-3 text-left">
              <div className="text-[10px] font-mono text-neutral-400 uppercase mb-2 flex items-center justify-between">
                <span>Telemetry Visual Captured:</span>
                <a
                  href={imageUrl}
                  download="visualization.png"
                  className="text-[#c5a059] hover:underline"
                >
                  Download Output
                </a>
              </div>
              <img
                src={imageUrl}
                alt="Visualization preview"
                className="max-h-32 mx-auto rounded border border-white/10 object-contain"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-center">
            <button
              onClick={onClose}
              className="bg-[#c5a059] hover:bg-[#d8b26e] text-black px-6 py-2 rounded-lg font-semibold text-xs tracking-wider uppercase transition-colors"
            >
              Return to Mission Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
