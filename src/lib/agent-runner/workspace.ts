import { promises as fs } from "node:fs";
import path from "node:path";

export async function buildWorkspaceContext(sessionId: string | undefined): Promise<string> {
  if (!sessionId || !/^[\w-]{8,128}$/.test(sessionId)) return "";
  const sessionDir = path.join("/tmp", sessionId);
  try {
    const files = await fs.readdir(sessionDir);
    const entries: string[] = [];
    for (const filename of files.slice(0, 20)) {
      if (!/^[\w.-]{1,200}$/.test(filename)) continue;
      const filePath = path.join(sessionDir, filename);
      if (!filePath.startsWith(sessionDir + path.sep) && filePath !== sessionDir) continue;
      try {
        const content = await fs.readFile(filePath, "utf8");
        entries.push(`### ${filename}\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``);
      } catch {
        /* skip */
      }
    }
    if (entries.length > 0) {
      return `\n\n---\n## Workspace Files\n${entries.join("\n\n")}`;
    }
  } catch {
    /* no session dir */
  }
  return "";
}
