"use client";

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
}

interface OutputPanelProps {
  running: boolean;
  result: RunResult | null;
  stdin: string;
  onStdinChange: (value: string) => void;
}

export default function OutputPanel({ running, result, stdin, onStdinChange }: OutputPanelProps) {
  const status = running
    ? { color: "bg-amber-400", label: "Running" }
    : result?.error || (result && result.exitCode !== 0)
      ? { color: "bg-(--accent-stop)", label: `Exit ${result?.exitCode ?? "—"}` }
      : result
        ? { color: "bg-(--accent-run)", label: "Succeeded" }
        : { color: "bg-(--text-tertiary)", label: "Idle" };

  return (
    <div className="h-full flex flex-col bg-(--surface-editor) text-neutral-200 font-(family-name:--font-mono) text-[12.5px]">
      <div className="flex items-center gap-2 px-3 h-8 border-b border-white/10 text-neutral-400 uppercase tracking-wide text-[10px] shrink-0 font-(family-name:--font-ui)">
        <span className={`w-2 h-2 rounded-full ${status.color}`} />
        <span>Console</span>
        <span className="ml-auto normal-case tracking-normal text-neutral-500">{status.label}</span>
      </div>
      {result && !result.error && (
        <div className="flex gap-3 px-3 py-2 border-b border-white/10 text-[11px] text-neutral-500">
          <span>{result.status ?? status.label}</span>
          {result.time && <span>{result.time}s</span>}
          {result.memory != null && <span>{result.memory} KB</span>}
        </div>
      )}
      <div className="border-b border-white/10 p-2 shrink-0">
        <label className="block text-[10px] uppercase tracking-wide text-neutral-500 mb-1">Stdin</label>
        <textarea
          value={stdin}
          onChange={(event) => onStdinChange(event.target.value)}
          placeholder="Input passed to the next run"
          rows={2}
          className="w-full resize-y rounded border border-white/10 bg-black/20 px-2 py-1.5 text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-(--accent)"
        />
      </div>
      <div className="flex-1 overflow-auto p-3 whitespace-pre-wrap leading-relaxed">
        {running && <div className="text-neutral-500">Running…</div>}

        {!running && !result && (
          <div className="text-neutral-600 font-(family-name:--font-ui)">Run a file to see output here.</div>
        )}

        {!running && result?.error && <div className="text-red-400">{result.error}</div>}

        {!running && result && !result.error && (
          <>
            {result.compileStderr && (
              <div className="text-yellow-400 mb-2">{result.compileStderr}</div>
            )}
            {result.stdout && <div className="text-neutral-200">{result.stdout}</div>}
            {result.stderr && <div className="text-red-400">{result.stderr}</div>}
            {result.status === "timeout" && !result.stderr?.includes("timed out") && (
              <div className="text-red-400">
                Execution timed out after approximately {result.time ? `${Math.round(Number(result.time))} seconds.` : "15 seconds."}
              </div>
            )}

            {/* Generated Plot Preview (Matplotlib / Seaborn) */}
            {result.image && (
              <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-2.5 overflow-hidden">
                <div className="flex items-center justify-between mb-2 text-[11px] text-neutral-400 font-(family-name:--font-ui)">
                  <span className="flex items-center gap-1.5 font-medium text-[#4ec9b0]">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z"/>
                    </svg>
                    Plot Output (Matplotlib / Seaborn)
                  </span>
                  <a
                    href={result.image}
                    download="visualization.png"
                    className="text-[10px] text-neutral-400 hover:text-white transition-colors underline"
                  >
                    Download PNG
                  </a>
                </div>
                <img
                  src={result.image}
                  alt="Generated Matplotlib / Seaborn visualization"
                  className="w-full rounded border border-white/5 object-contain max-h-[280px] bg-[#181818]"
                />
              </div>
            )}

            {!result.stdout && !result.stderr && !result.compileStderr && !result.image && result.status !== "timeout" && (
              <div className="text-neutral-500 font-(family-name:--font-ui)">(no output)</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
