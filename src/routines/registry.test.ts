import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findRoutine, routines } from "./registry";

// Guarda de arquitetura: cada pasta em src/routines é uma rotina registrada, e vice-versa.
const routinesDir = join(process.cwd(), "src", "routines");
const routineFolders = readdirSync(routinesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe("registro de rotinas", () => {
  it("tem ids únicos em kebab-case", () => {
    const ids = routines.map((routine) => routine.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("registra exatamente as pastas existentes, com id igual ao nome da pasta", () => {
    expect([...routines.map((r) => r.id)].sort()).toEqual([...routineFolders].sort());
  });

  it.each(routineFolders)("a pasta %s tem README.md, SPEC.md e testes", (folder) => {
    const files = readdirSync(join(routinesDir, folder));
    expect(existsSync(join(routinesDir, folder, "README.md"))).toBe(true);
    expect(existsSync(join(routinesDir, folder, "SPEC.md"))).toBe(true);
    expect(files.some((file) => /\.test\.tsx?$/.test(file))).toBe(true);
  });

  it("findRoutine encontra por id e retorna undefined para id desconhecido", () => {
    expect(findRoutine("hello-world")?.title).toBe("Olá Mundo");
    expect(findRoutine("nao-existe")).toBeUndefined();
  });
});
