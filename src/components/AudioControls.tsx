"use client";

import { useState, useEffect } from "react";
import { heistAudio } from "@/lib/audio";

export default function AudioControls() {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [showSlider, setShowSlider] = useState(false);

  useEffect(() => {
    setMuted(heistAudio.isMuted());
    setVolume(heistAudio.getVolume());

    const unsubscribe = heistAudio.subscribe(() => {
      setMuted(heistAudio.isMuted());
      setVolume(heistAudio.getVolume());
    });

    return () => unsubscribe();
  }, []);

  const handleToggleMute = () => {
    heistAudio.toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    heistAudio.setVolume(val);
    if (muted && val > 0) {
      heistAudio.setMuted(false);
    }
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        onClick={handleToggleMute}
        title={muted ? "Unmute Audio" : `Audio: ${Math.round(volume * 100)}% (Click to Mute)`}
        aria-label="Toggle Heist Soundtrack Audio"
        className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors border ${
          muted
            ? "border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300"
            : "border-[#c5a059]/40 bg-[#c5a059]/10 text-[#c5a059] hover:border-[#c5a059] hover:bg-[#c5a059]/20"
        }`}
      >
        {muted ? (
          /* Muted Icon */
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          /* Volume Audio Icon */
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {/* Floating Volume Slider on Hover */}
      {showSlider && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#121217] border border-white/10 p-2.5 rounded-lg shadow-xl flex items-center gap-2 min-w-[130px]">
          <span className="text-[9.5px] font-mono text-[#c5a059] uppercase font-semibold">VOL</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-18 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#c81d25]"
          />
          <span className="text-[9.5px] font-mono text-neutral-300 min-w-[24px] text-right">
            {muted ? "0%" : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      )}
    </div>
  );
}
