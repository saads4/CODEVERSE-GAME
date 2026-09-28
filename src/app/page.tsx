"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { parseErrorBody } from "@/lib/http";
import { IconFolder, IconPlay, IconTrash } from "@/components/icons";
import { useToast } from "@/components/ToastProvider";
import { useDialog } from "@/components/DialogProvider";
import { isFileSystemAccessSupported } from "@/lib/localFs";
import { saveDirectoryHandle } from "@/lib/localHandleStore";
import { setPendingDirectoryHandle } from "@/lib/pendingLocalHandle";

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localFsSupported, setLocalFsSupported] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run client-side to avoid an SSR/hydration mismatch
    setLocalFsSupported(isFileSystemAccessSupported());
  }, []);

  const load = async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(await parseErrorBody(res));
      setProjects(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load operations blueprint");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- simple fetch-on-mount, no external data lib in this learning project
    void load();
  }, []);

  const createProject = async () => {
    if (creating) return;
    const name = newName.trim() || "Untitled Mission";
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        toast.show(await parseErrorBody(res), "error");
        return;
      }
      const project = await res.json();
      setNewName("");
      router.push(`/project/${project.id}`);
    } catch {
      toast.show("Couldn't create mission workspace — check your connection.", "error");
    } finally {
      setCreating(false);
    }
  };

  const openLocalFolder = async () => {
    if (!localFsSupported) {
      toast.show("Local folder editing needs Chrome or Edge — not supported in this browser.", "error");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await saveDirectoryHandle(handle);
      setPendingDirectoryHandle(handle);
      router.push("/local");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.show("Couldn't open that folder.", "error");
    }
  };

  const deleteProject = async (p: Project) => {
    const ok = await dialog.confirm({
      title: `Delete "${p.name}"?`,
      message: "This permanently deletes the workspace and every file in it. This action cannot be undone.",
      confirmLabel: "Delete Mission",
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(p.id);
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.show(await parseErrorBody(res), "error");
        return;
      }
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      toast.show("Couldn't delete mission workspace — check your connection.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center bg-[#0a0a0d] text-neutral-200 min-h-screen px-6 py-14">
      <div className="w-full max-w-xl">
        {/* Header Badge */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="text-xl">🎭</span>
          <span className="stamp-classified">EYES ONLY // TOP SECRET</span>
        </div>

        <h1 className="text-[26px] font-bold tracking-tight mb-1 text-white uppercase">
          Plan Del Profesor
        </h1>
        <p className="text-neutral-400 text-[13px] mb-8 font-mono">
          ML Heist Operations Command & Python Control Center.
        </p>

        {/* Featured Heist Challenge Banner */}
        <div className="mb-8 p-5 rounded-xl bg-[#121216] border border-[#c81d25]/30 hover:border-[#c81d25]/50 transition-colors flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🏛️</span>
              <div>
                <span className="text-[10px] font-mono uppercase text-[#c5a059] font-bold tracking-wider">
                  ACTIVE OPERATION
                </span>
                <h2 className="text-base font-semibold text-white">
                  Printing Press ML Heist
                </h2>
              </div>
            </div>
            <span className="stamp-gold">1000 PTS</span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Infiltrate the Royal Mint's production telemetry and predict the currency print yields before the vault closes.
          </p>

          <Link
            href="/printing-press"
            className="w-full flex items-center justify-center gap-2 bg-[#c81d25] hover:bg-[#db2831] text-white rounded-lg h-9 text-[12.5px] font-semibold tracking-wider uppercase transition-colors"
          >
            <IconPlay className="w-3 h-3 text-white" />
            Enter ML Heist Control Room
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-[#c81d25]/30 bg-[#c81d25]/10 px-3.5 py-3 text-[13px] text-[#ff8080] leading-relaxed">
            {error}
          </div>
        )}

        {/* Create workspace */}
        <div className="flex gap-2 mb-6">
          <input
            className="flex-1 bg-[#121216] border border-white/10 rounded-lg px-3.5 h-9 text-[13px] outline-none focus-visible:border-[#c81d25] placeholder:text-neutral-500 disabled:opacity-60 text-white"
            placeholder="New heist blueprint name..."
            value={newName}
            disabled={creating}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createProject()}
          />
          <button
            onClick={createProject}
            disabled={creating}
            className="bg-[#18181f] hover:bg-[#20202a] border border-[#c5a059]/40 text-[#c5a059] hover:border-[#c5a059] disabled:opacity-60 px-4 h-9 rounded-lg text-[12.5px] font-medium transition min-w-[80px]"
          >
            {creating ? "Creating…" : "New Plan"}
          </button>
        </div>

        <div className="flex flex-col gap-2.5 mb-9">
          <button
            onClick={openLocalFolder}
            title={localFsSupported ? undefined : "Needs Chrome or Edge"}
            className="w-full flex items-center justify-center gap-2 border border-dashed border-white/10 hover:border-[#c5a059]/60 hover:text-[#c5a059] text-neutral-400 rounded-lg h-10 text-[13px] font-medium transition-colors bg-[#0e0e12]"
          >
            <IconFolder className="w-4 h-4" />
            Mount Local Tactical Directory
          </button>
        </div>

        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#c5a059] mb-3">
          Archived Blueprints & Missions
        </h2>

        {loading && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[48px] rounded-lg bg-white/[.02] animate-pulse border border-white/5"
              />
            ))}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="text-neutral-500 text-[13px] border border-dashed border-white/10 rounded-lg px-4 py-8 text-center bg-[#0d0d10]">
            No custom blueprints created yet. Start a new plan or enter the ML Heist Control Room above.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-3 bg-[#111115] hover:bg-[#15151a] border border-white/5 hover:border-white/15 rounded-lg px-3.5 py-2.5 text-[13px] transition-colors"
            >
              <button
                onClick={() => router.push(`/project/${p.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <span className="text-[#c81d25]">
                  <IconFolder className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{p.name}</div>
                  <div className="text-neutral-500 text-[11px] font-mono mt-0.5">
                    {new Date(p.created_at).toLocaleString()}
                  </div>
                </span>
              </button>
              <button
                title="Delete mission"
                aria-label={`Delete ${p.name}`}
                onClick={() => deleteProject(p)}
                disabled={deletingId === p.id}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-md text-neutral-500 hover:text-[#c81d25] hover:bg-[#c81d25]/10 transition disabled:opacity-60"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
