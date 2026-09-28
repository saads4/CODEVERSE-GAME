import { flattenTreeWithPaths } from "@/lib/previewFiles";
import type { TreeNode, WorkspaceNode } from "@/lib/types";

const EXECUTOR_URL = process.env.EXECUTOR_URL || "http://localhost:4000";

export async function syncWorkspaceFiles<T extends WorkspaceNode>(
  projectId: string,
  tree: T[]
): Promise<void> {
  try {
    const files = flattenTreeWithPaths(tree).map(({ path, node }) => {
      const treeNode = node as Partial<TreeNode>;
      return {
        path,
        type: node.type,
        content: typeof treeNode.content === "string" ? treeNode.content : "",
      };
    });

    await fetch(`${EXECUTOR_URL}/sync-workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, files }),
    });
  } catch {
    // Graceful offline degradation if executor server is not running
  }
}

