"use client";

/**
 * Money Heist Audio Manager
 * Provides configurable sound paths, volume control, and mute toggle.
 * Safely handles missing sound files without breaking the application.
 */

export interface SoundConfig {
  missionStart: string;
  validationFailure: string;
  validationSuccess: string;
  vaultUnlock: string;
}

export const DEFAULT_SOUNDS: SoundConfig = {
  missionStart: "/sounds/mission_start.mp3",
  validationFailure: "/sounds/validation_failure.mp3",
  validationSuccess: "/sounds/validation_success.mp3",
  vaultUnlock: "/sounds/vault_unlock.mp3",
};

class HeistAudioManager {
  private config: SoundConfig = { ...DEFAULT_SOUNDS };
  private volume: number = 0.5; // 0.0 to 1.0
  private muted: boolean = false;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const savedMute = localStorage.getItem("heist_audio_muted");
        if (savedMute !== null) this.muted = savedMute === "true";
        const savedVol = localStorage.getItem("heist_audio_volume");
        if (savedVol !== null) this.volume = parseFloat(savedVol);
      } catch {
        // localStorage not available
      }
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("heist_audio_volume", String(this.volume));
      } catch {}
    }
    this.audioCache.forEach((audio) => {
      audio.volume = this.volume;
    });
    this.notify();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("heist_audio_muted", String(this.muted));
      } catch {}
    }
    this.notify();
    return this.muted;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("heist_audio_muted", String(this.muted));
      } catch {}
    }
    this.notify();
  }

  public updateConfig(newConfig: Partial<SoundConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public play(key: keyof SoundConfig) {
    if (typeof window === "undefined" || this.muted) return;

    const path = this.config[key];
    if (!path) return;

    try {
      let audio = this.audioCache.get(path);
      if (!audio) {
        audio = new Audio(path);
        audio.preload = "auto";
        this.audioCache.set(path, audio);
      }
      audio.volume = this.volume;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // File may not exist yet or autoplay was blocked; silently handle.
        });
      }
    } catch {
      // Audio not supported or failed to load
    }
  }
}

export const heistAudio = new HeistAudioManager();
