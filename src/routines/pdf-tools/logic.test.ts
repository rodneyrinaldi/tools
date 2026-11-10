import { describe, expect, it } from "vitest";
import { matchesMask, parseMask, validateMask } from "./mask";
import {
  formatBytes,
  isGeneratedName,
  mergeOutputName,
  numberedName,
  outputNameFor,
} from "./naming";
import {
  buildSummary,
  missingToolFor,
  validateOptions,
  type RunRequest,
  type Tools,
} from "./operations";

describe("máscara", () => {
  const matches = (mask: string, name: string) => matchesMask(name, parseMask(mask));

  it("aceita * e ?, sem diferenciar maiúsculas", () => {
    expect(matches("*.pdf", "Relatório Final.PDF")).toBe(true);
    expect(matches("nf-??.pdf", "nf-01.pdf")).toBe(true);
    expect(matches("nf-??.pdf", "nf-001.pdf")).toBe(false);
    expect(matches("*.pdf", "notas.docx")).toBe(false);
  });

  it("aceita várias máscaras separadas por ;", () => {
    expect(matches("nf-*.pdf; recibo*.pdf", "recibo-03.pdf")).toBe(true);
    expect(matches("nf-*.pdf; recibo*.pdf", "contrato.pdf")).toBe(false);
  });

  it("trata caracteres especiais de regex como texto", () => {
    expect(matches("(2024)+*.pdf", "(2024)+nota.pdf")).toBe(true);
    expect(matches("a.b.pdf", "aXb.pdf")).toBe(false);
  });

  it("valida máscara vazia e com caminho", () => {
    expect(validateMask(" ; ")).toMatch(/Informe/);
    expect(validateMask("pasta\\*.pdf")).toMatch(/só ao nome/);
    expect(validateMask("*.pdf")).toBeNull();
  });
});

describe("nomes de saída", () => {
  it("acrescenta o sufixo da operação", () => {
    expect(outputNameFor("nota.pdf", "compress")).toBe("nota-comprimido.pdf");
    expect(outputNameFor("contrato.final.pdf", "a4")).toBe("contrato.final-a4.pdf");
    expect(outputNameFor("x.pdf", "protect")).toBe("x-protegido.pdf");
    expect(outputNameFor("x.pdf", "unprotect")).toBe("x-desprotegido.pdf");
  });

  it("juntar usa data e hora", () => {
    expect(mergeOutputName(new Date(2026, 9, 5, 8, 3, 9))).toBe(
      "juntado-20261005-080309.pdf",
    );
  });

  it("numera quando o nome já existe", () => {
    expect(numberedName("nota-a4.pdf", 1)).toBe("nota-a4.pdf");
    expect(numberedName("nota-a4.pdf", 3)).toBe("nota-a4 (3).pdf");
  });

  it("reconhece arquivos gerados pela rotina", () => {
    expect(isGeneratedName("nota-comprimido.pdf")).toBe(true);
    expect(isGeneratedName("nota-a4 (2).pdf")).toBe(true);
    expect(isGeneratedName("juntado-20261005-080309.pdf")).toBe(true);
    expect(isGeneratedName("nota.pdf")).toBe(false);
    expect(isGeneratedName("juntado-final.pdf")).toBe(false);
  });

  it("formata tamanhos", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });
});

describe("validação e ferramentas", () => {
  const all: Tools = { qpdf: true, ghostscript: true, docx: "word" };
  const none: Tools = { qpdf: false, ghostscript: false, docx: null };

  it("exige 2 arquivos para juntar e senha confirmada para proteger", () => {
    expect(validateOptions("merge", 1, "", "")).toMatch(/2 arquivos/);
    expect(validateOptions("merge", 2, "", "")).toBeNull();
    expect(validateOptions("protect", 3, "abc", "abc")).toMatch(/4 caracteres/);
    expect(validateOptions("protect", 3, "segredo", "segred0")).toMatch(/não confere/);
    expect(validateOptions("protect", 3, "segredo", "segredo")).toBeNull();
    expect(validateOptions("unprotect", 3, "", "")).toMatch(/senha atual/);
    expect(validateOptions("a4", 0, "", "")).toMatch(/Nenhum arquivo/);
  });

  it("informa ferramentas ausentes por operação", () => {
    expect(missingToolFor("protect", none)).toMatch(/qpdf/);
    expect(missingToolFor("compress", none)).toMatch(/Ghostscript/);
    expect(missingToolFor("compress", { ...none, qpdf: true })).toBeNull();
    expect(missingToolFor("merge", none)).toBeNull();
    expect(missingToolFor("a4", none)).toBeNull();
    expect(missingToolFor("unprotect", all)).toBeNull();
  });
});

describe("resumo de confirmação", () => {
  const request: RunRequest = {
    root: "D:\\Notas",
    recursive: true,
    mask: "*.pdf",
    operation: "compress",
    level: "medium",
    password: "",
  };
  const file = { path: "D:\\Notas\\a.pdf", relativePath: "a.pdf", size: 10 };

  it("descreve operação, quantidade, local, conversões e garantias", () => {
    const text = buildSummary(request, {
      pdfs: [file, file],
      docx: [file],
      tools: { qpdf: true, ghostscript: true, docx: "word" },
    }).join(" ");
    expect(text).toContain(
      "Vou comprimir 3 arquivos em D:\\Notas e subpastas (máscara *.pdf)",
    );
    expect(text).toContain("1 documento DOCX será convertido");
    expect(text).toContain("Microsoft Word");
    expect(text).toContain("Compressão médio");
    expect(text).toContain("-comprimido.pdf");
    expect(text).toContain("Nenhum arquivo original será alterado");
  });

  it("avisa compressão estrutural sem Ghostscript e descreve juntar", () => {
    const tools = { qpdf: true, ghostscript: false, docx: null };
    expect(buildSummary(request, { pdfs: [file], docx: [], tools }).join(" ")).toContain(
      "Ghostscript não encontrado",
    );
    expect(
      buildSummary(
        { ...request, operation: "merge", recursive: false },
        {
          pdfs: [file, file],
          docx: [],
          tools,
        },
      ).join(" "),
    ).toContain("em um único arquivo, juntado-AAAAMMDD-HHMMSS.pdf, gravado em D:\\Notas");
  });
});
