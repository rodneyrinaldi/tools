// Hook PostToolUse: formata com Prettier o arquivo que o Claude acabou de editar.
// Falhas nunca bloqueiam o fluxo — no pior caso o arquivo fica sem formatar.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname } from "node:path";

const FORMATTABLE = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md"]);

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const filePath = JSON.parse(input)?.tool_input?.file_path;
    if (!filePath || !existsSync(filePath) || !FORMATTABLE.has(extname(filePath))) return;
    if (/[\\/](node_modules|\.next)[\\/]/.test(filePath)) return;

    execFileSync("npx", ["prettier", "--write", "--log-level", "warn", filePath], {
      cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
      stdio: "ignore",
      shell: process.platform === "win32",
    });
  } catch {
    // silencioso de propósito
  }
});
