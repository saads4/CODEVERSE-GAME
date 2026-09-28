import type { Runner } from "@/lib/languageMap";

const EXECUTOR_URL = process.env.EXECUTOR_URL || "http://localhost:4000";

const REQUEST_TIMEOUT_MS = 310_000;

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  compileStderr?: string;
  status: string;
  time: string | null;
  memory: number | null;
}

export async function executeCode(
  language: Runner,
  sourceCode: string,
  stdin = "",
  projectId?: string
): Promise<ExecuteResult> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${EXECUTOR_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        source: sourceCode,
        stdin,
        projectId,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Executor failed: ${response.status} ${await response.text()}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        stdout: "",
        stderr: "Execution request timed out.",
        exitCode: 124,
        status: "timeout",
        time: null,
        memory: null,
      };
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}