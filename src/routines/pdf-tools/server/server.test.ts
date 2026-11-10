// @vitest-environment node
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { degrees, PDFDocument, PageSizes, rgb } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunRequest } from "../operations";
import { isLocalHost } from "./local";
import { convertToA4, mergePdfs } from "./pdf";
import { runOperation, uniquePath } from "./run";
import { scanFolder, ScanError } from "./scan";
import { locateTools } from "./tools";

const tools = await locateTools();

async function makePdf(pages: [number, number][], rotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of pages) {
    const page = doc.addPage(size);
    page.drawRectangle({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      color: rgb(0.5, 0.2, 0.8),
    });
    if (rotation) page.setRotation(degrees(rotation));
  }
  return doc.save();
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "pdf-tools-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const request = (overrides: Partial<RunRequest>): RunRequest => ({
  root: dir,
  recursive: false,
  mask: "*.pdf",
  operation: "merge",
  level: "medium",
  password: "",
  ...overrides,
});

describe("isLocalHost", () => {
  it("aceita só o próprio computador", () => {
    expect(isLocalHost("localhost:3000")).toBe(true);
    expect(isLocalHost("127.0.0.1:3000")).toBe(true);
    expect(isLocalHost("[::1]:3000")).toBe(true);
    expect(isLocalHost("192.168.0.10:3000")).toBe(false);
    expect(isLocalHost("localhost.evil.com")).toBe(false);
    expect(isLocalHost(null)).toBe(false);
  });
});

describe("scanFolder", () => {
  beforeEach(async () => {
    await mkdir(path.join(dir, "sub"));
    await writeFile(path.join(dir, "b.pdf"), "x");
    await writeFile(path.join(dir, "A.PDF"), "x");
    await writeFile(path.join(dir, "a-comprimido.pdf"), "x");
    await writeFile(path.join(dir, "notas.txt"), "x");
    await writeFile(path.join(dir, "carta.docx"), "x");
    await writeFile(path.join(dir, "b.docx"), "x"); // já tem b.pdf
    await writeFile(path.join(dir, "~$carta.docx"), "x"); // temporário do Word
    await writeFile(path.join(dir, "sub", "c.pdf"), "x");
  });

  it("sem subpastas: PDFs da máscara, DOCX sem PDF e gerados ignorados", async () => {
    const result = await scanFolder({ root: dir, recursive: false, mask: "*.pdf" });
    expect(result.pdfs.map((f) => f.relativePath)).toEqual(["A.PDF", "b.pdf"]);
    expect(result.docx.map((f) => f.relativePath)).toEqual(["carta.docx"]);
    expect(result.ignored).toBe(1);
  });

  it("com subpastas e máscara específica", async () => {
    const all = await scanFolder({ root: dir, recursive: true, mask: "*.pdf" });
    expect(all.pdfs.map((f) => f.relativePath)).toContain(path.join("sub", "c.pdf"));

    const filtered = await scanFolder({ root: dir, recursive: true, mask: "c*.pdf" });
    expect(filtered.pdfs.map((f) => f.relativePath)).toEqual([path.join("sub", "c.pdf")]);
    expect(filtered.docx.map((f) => f.relativePath)).toEqual(["carta.docx"]);
  });

  it("rejeita caminho relativo, inexistente ou máscara inválida", async () => {
    await expect(
      scanFolder({ root: "pasta", recursive: false, mask: "*.pdf" }),
    ).rejects.toThrow(ScanError);
    await expect(
      scanFolder({ root: path.join(dir, "nao-existe"), recursive: false, mask: "*.pdf" }),
    ).rejects.toThrow(/não existe/);
    await expect(scanFolder({ root: dir, recursive: false, mask: "" })).rejects.toThrow(
      /máscara/,
    );
  });
});

describe("pdf-lib: juntar e A4", () => {
  it("juntar preserva a ordem e o total de páginas", async () => {
    const merged = await PDFDocument.load(
      await mergePdfs([
        await makePdf([[100, 100]]),
        await makePdf([
          [200, 300],
          [300, 200],
        ]),
      ]),
    );
    expect(merged.getPageCount()).toBe(3);
    expect(merged.getPage(1).getSize()).toEqual({ width: 200, height: 300 });
  });

  it("A4 respeita orientação e rotação", async () => {
    const [w, h] = PageSizes.A4;
    const portrait = await PDFDocument.load(
      await convertToA4(await makePdf([[612, 1008]])),
    );
    expect(portrait.getPage(0).getSize()).toEqual({ width: w, height: h });

    const landscape = await PDFDocument.load(
      await convertToA4(await makePdf([[1000, 500]])),
    );
    expect(landscape.getPage(0).getSize()).toEqual({ width: h, height: w });

    // Página retrato girada 90° aparece em paisagem.
    const rotated = await PDFDocument.load(
      await convertToA4(await makePdf([[500, 1000]], 90)),
    );
    expect(rotated.getPage(0).getSize()).toEqual({ width: h, height: w });
    expect(rotated.getPage(0).getRotation().angle).toBe(0);
  });
});

describe("runOperation", () => {
  it("juntar grava um único arquivo e não altera os originais", async () => {
    const first = await makePdf([[100, 100]]);
    await writeFile(path.join(dir, "1.pdf"), first);
    await writeFile(
      path.join(dir, "2.pdf"),
      await makePdf([
        [100, 100],
        [100, 100],
      ]),
    );

    const report = await runOperation(
      request({ operation: "merge" }),
      new Date(2026, 0, 2, 3, 4, 5),
    );
    if (!report.ok) throw new Error(report.error);
    expect(report.results).toHaveLength(1);
    expect(report.results[0].output).toBe(path.join(dir, "juntado-20260102-030405.pdf"));
    const merged = await PDFDocument.load(await readFile(report.results[0].output!));
    expect(merged.getPageCount()).toBe(3);
    expect(await readFile(path.join(dir, "1.pdf"))).toEqual(Buffer.from(first));
  });

  it("A4 grava ao lado do original e numera se o nome existir", async () => {
    await writeFile(path.join(dir, "nota.pdf"), await makePdf([[300, 300]]));
    await writeFile(path.join(dir, "nota-a4.pdf"), "ocupado"); // será ignorado na busca

    const report = await runOperation(request({ operation: "a4" }));
    if (!report.ok) throw new Error(report.error);
    expect(report.results[0]).toMatchObject({
      status: "ok",
      output: path.join(dir, "nota-a4 (2).pdf"),
    });
    expect(await readFile(path.join(dir, "nota-a4.pdf"), "utf8")).toBe("ocupado");
  });

  it("recusa juntar um único arquivo", async () => {
    await writeFile(path.join(dir, "so.pdf"), await makePdf([[100, 100]]));
    const report = await runOperation(request({ operation: "merge" }));
    expect(report).toEqual({ ok: false, error: expect.stringMatching(/2 arquivos/) });
  });

  it.skipIf(!tools.qpdf)("proteger e desproteger com qpdf", async () => {
    await writeFile(path.join(dir, "doc.pdf"), await makePdf([[200, 200]]));

    const protectedReport = await runOperation(
      request({ operation: "protect", password: "segredo" }),
    );
    if (!protectedReport.ok) throw new Error(protectedReport.error);
    const protectedPath = path.join(dir, "doc-protegido.pdf");
    expect(protectedReport.results[0]).toMatchObject({
      status: "ok",
      output: protectedPath,
    });
    await expect(PDFDocument.load(await readFile(protectedPath))).rejects.toThrow(
      /encrypt/i,
    );

    // Desproteger o arquivo protegido (copiado com nome "normal" para entrar na busca).
    await rm(path.join(dir, "doc.pdf"));
    await writeFile(path.join(dir, "cofre.pdf"), await readFile(protectedPath));

    const wrong = await runOperation(
      request({ operation: "unprotect", password: "errada" }),
    );
    if (!wrong.ok) throw new Error(wrong.error);
    expect(wrong.results[0]).toMatchObject({
      status: "error",
      message: "Senha incorreta.",
    });
    expect(
      (await readdir(dir)).some((name) => name.startsWith("cofre-desprotegido")),
    ).toBe(false);

    const right = await runOperation(
      request({ operation: "unprotect", password: "segredo" }),
    );
    if (!right.ok) throw new Error(right.error);
    expect(right.results[0].status).toBe("ok");
    const opened = await PDFDocument.load(await readFile(right.results[0].output!));
    expect(opened.getPageCount()).toBe(1);
  });

  it.skipIf(!tools.qpdf && !tools.ghostscript)(
    "comprimir descarta resultado sem ganho",
    async () => {
      // PDF mínimo, já enxuto: dificilmente fica menor.
      await writeFile(path.join(dir, "mini.pdf"), await makePdf([[50, 50]]));
      const report = await runOperation(request({ operation: "compress" }));
      if (!report.ok) throw new Error(report.error);
      const [result] = report.results;
      if (result.status === "unchanged") {
        expect(result.output).toBeUndefined();
        expect((await readdir(dir)).filter((n) => n.includes("comprimido"))).toHaveLength(
          0,
        );
      } else {
        expect(result.status).toBe("ok");
        expect((await stat(result.output!)).size).toBeLessThan(result.sizeBefore!);
      }
    },
  );

  it.skipIf(!(tools.word || tools.soffice) || !process.env.PDF_TOOLS_TEST_DOCX)(
    "converte DOCX sem PDF antes da operação (opt-in: PDF_TOOLS_TEST_DOCX=caminho.docx)",
    async () => {
      const source = process.env.PDF_TOOLS_TEST_DOCX!;
      await writeFile(path.join(dir, "documento.docx"), await readFile(source));
      await writeFile(path.join(dir, "outro.pdf"), await makePdf([[100, 100]]));

      const report = await runOperation(request({ operation: "merge" }));
      if (!report.ok) throw new Error(report.error);
      expect(report.conversions[0]).toMatchObject({
        status: "ok",
        output: path.join(dir, "documento.pdf"),
      });
      expect(report.results[0].status).toBe("ok");
    },
    120_000,
  );

  it("uniquePath escolhe o primeiro nome livre", async () => {
    await writeFile(path.join(dir, "x.pdf"), "1");
    await writeFile(path.join(dir, "x (2).pdf"), "2");
    expect(uniquePath(dir, "x.pdf")).toBe(path.join(dir, "x (3).pdf"));
  });
});
