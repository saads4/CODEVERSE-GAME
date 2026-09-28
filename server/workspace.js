/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { WORKSPACES_ROOT, CHALLENGES_DATA_DIR } = require("./config");

// Ensure root workspace directory exists
if (!fs.existsSync(WORKSPACES_ROOT)) {
  fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

const PP_TRAIN_SRC = path.join(CHALLENGES_DATA_DIR, "train.csv");
const PP_TEST_SRC = path.join(CHALLENGES_DATA_DIR, "test.csv");
// Note: answer_key.csv is strictly private and NEVER copied to any workspace

/**
 * Copies challenge datasets into the target workspace directory.
 */
function copyChallengeDatasets(workspaceDir) {
  const datasets = [
    [PP_TRAIN_SRC, "train.csv"],
    [PP_TEST_SRC, "test.csv"],
  ];
  for (const [src, name] of datasets) {
    if (!fs.existsSync(src)) continue;
    const dest = path.join(workspaceDir, name);
    try {
      fs.copyFileSync(src, dest);
    } catch {
      // Non-fatal if copy fails
    }
  }
}

// Pre-seed the root workspace on startup
copyChallengeDatasets(WORKSPACES_ROOT);

/**
 * Sanitizes project IDs to prevent directory traversal.
 */
function sanitizeProjectId(rawId) {
  if (!rawId || typeof rawId !== "string") return "default";
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned.slice(0, 64) || "default";
}

/**
 * Resolves and creates a safe workspace directory for a project ID.
 */
function getWorkspaceDir(projectId) {
  const safeId = sanitizeProjectId(projectId);
  const targetDir = path.resolve(WORKSPACES_ROOT, safeId);

  // Security check: ensure path is within WORKSPACES_ROOT
  if (!targetDir.startsWith(WORKSPACES_ROOT)) {
    throw new Error("Invalid workspace path: directory traversal detected");
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Pre-seed datasets into workspace
  copyChallengeDatasets(targetDir);

  return targetDir;
}

/**
 * Synchronizes files from the IDE into the workspace directory.
 */
async function syncFilesToWorkspace(projectId, files) {
  if (!projectId || !Array.isArray(files)) {
    throw new Error("projectId and files array are required");
  }

  const workspaceDir = getWorkspaceDir(projectId);
  let syncedCount = 0;

  for (const item of files) {
    if (!item || typeof item.path !== "string") continue;
    const relativePath = item.path.replace(/^[/\\]+/, "");
    const targetPath = path.resolve(workspaceDir, relativePath);

    // Prevent path traversal
    if (!targetPath.startsWith(workspaceDir)) continue;

    if (item.type === "folder") {
      await fsp.mkdir(targetPath, { recursive: true });
    } else if (item.content !== undefined) {
      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.writeFile(targetPath, String(item.content), "utf8");
      syncedCount++;
    }
  }

  return { syncedCount, workspaceDir };
}

/**
 * Lists all files inside a workspace directory recursively.
 */
async function listWorkspaceFiles(projectId) {
  const safeId = sanitizeProjectId(projectId);
  const workspaceDir = getWorkspaceDir(safeId);

  async function listDir(dir, baseRel = "") {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      const rel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        items.push({ name: entry.name, path: rel, type: "folder" });
        const subItems = await listDir(path.join(dir, entry.name), rel);
        items.push(...subItems);
      } else {
        const stats = await fsp.stat(path.join(dir, entry.name));
        items.push({
          name: entry.name,
          path: rel,
          type: "file",
          size: stats.size,
        });
      }
    }
    return items;
  }

  const files = await listDir(workspaceDir);
  return { projectId: safeId, files };
}

module.exports = {
  sanitizeProjectId,
  getWorkspaceDir,
  copyChallengeDatasets,
  syncFilesToWorkspace,
  listWorkspaceFiles,
};
