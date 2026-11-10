import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunReport, ScanResult } from "./operations";
import PdfTools from "./PdfTools";
import { runAction, scanAction } from "./server/actions";

vi.mock("./server/actions", () => ({ scanAction: vi.fn(), runAction: vi.fn() }));

const scanMock = vi.mocked(scanAction);
const runMock = vi.mocked(runAction);

const SCAN: ScanResult = {
  ok: true,
  root: "D:\\Notas",
  pdfs: [
    { path: "D:\\Notas\\a.pdf", relativePath: "a.pdf", size: 2048 },
    { path: "D:\\Notas\\b.pdf", relativePath: "b.pdf", size: 4096 },
  ],
  docx: [{ path: "D:\\Notas\\carta.docx", relativePath: "carta.docx", size: 1024 }],
  ignored: 1,
  tools: { qpdf: true, ghostscript: true, docx: "word" },
};

async function searchFolder() {
  fireEvent.change(screen.getByLabelText("Pasta"), { target: { value: "D:\\Notas" } });
  fireEvent.click(screen.getByRole("button", { name: "Procurar" }));
  return screen.findByText("3 arquivos");
}

beforeEach(() => {
  localStorage.clear();
  scanMock.mockReset();
  runMock.mockReset();
});

describe("<PdfTools />", () => {
  it("procura, lista arquivos e DOCX a converter", async () => {
    scanMock.mockResolvedValue(SCAN);
    render(<PdfTools />);

    expect(screen.getByRole("button", { name: "Procurar" })).toBeDisabled();
    await searchFolder();

    expect(scanMock).toHaveBeenCalledWith({
      root: "D:\\Notas",
      recursive: false,
      mask: "*.pdf",
    });
    expect(screen.getByText("carta.docx")).toBeInTheDocument();
    expect(screen.getByText("DOCX → PDF")).toBeInTheDocument();
    expect(screen.getByText(/1 gerado anteriormente ignorado/)).toBeInTheDocument();
  });

  it("mostra o resumo e só executa após confirmar", async () => {
    scanMock.mockResolvedValue(SCAN);
    const report: RunReport = {
      ok: true,
      notes: [],
      conversions: [
        {
          source: "D:\\Notas\\carta.docx",
          status: "ok",
          output: "D:\\Notas\\carta.pdf",
          message: "Convertido para PDF.",
        },
      ],
      results: [
        {
          source: "3 arquivos",
          status: "ok",
          output: "D:\\Notas\\juntado-20261015-101010.pdf",
          sizeAfter: 7000,
        },
      ],
    };
    runMock.mockResolvedValue(report);
    render(<PdfTools />);
    await searchFolder();

    fireEvent.click(screen.getByRole("button", { name: "Revisar e confirmar" }));
    expect(screen.getByText(/Vou juntar 3 arquivos em D:\\Notas/)).toBeInTheDocument();
    expect(screen.getByText(/1 documento DOCX será convertido/)).toBeInTheDocument();
    expect(runMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e executar" }));
    expect(await screen.findByText(/Concluído: 1 resultado/)).toBeInTheDocument();
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "merge", root: "D:\\Notas" }),
    );
    expect(
      screen.getByText("D:\\Notas\\juntado-20261015-101010.pdf"),
    ).toBeInTheDocument();
  });

  it("proteger exige senha confirmada antes de liberar a revisão", async () => {
    scanMock.mockResolvedValue(SCAN);
    render(<PdfTools />);
    fireEvent.click(screen.getByRole("radio", { name: "Proteger" }));
    await searchFolder();

    const review = screen.getByRole("button", { name: "Revisar e confirmar" });
    fireEvent.change(screen.getByLabelText("Senha para abrir"), {
      target: { value: "segredo" },
    });
    fireEvent.change(screen.getByLabelText("Confirme a senha"), {
      target: { value: "outra" },
    });
    expect(review).toBeDisabled();
    expect(
      screen.getByText("A confirmação não confere com a senha."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Confirme a senha"), {
      target: { value: "segredo" },
    });
    expect(review).toBeEnabled();
  });

  it("avisa ferramentas ausentes e bloqueia a operação", async () => {
    scanMock.mockResolvedValue({
      ...SCAN,
      tools: { qpdf: false, ghostscript: false, docx: "word" },
    });
    render(<PdfTools />);
    fireEvent.click(screen.getByRole("radio", { name: "Desproteger" }));
    await searchFolder();

    expect(screen.getByText(/qpdf não encontrado/)).toBeInTheDocument();
    expect(screen.getByText("winget install --id QPDF.QPDF -e")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar e confirmar" })).toBeDisabled();
  });

  it("mudar a pasta invalida a busca anterior; erros da busca aparecem", async () => {
    scanMock.mockResolvedValueOnce(SCAN);
    render(<PdfTools />);
    await searchFolder();

    fireEvent.change(screen.getByLabelText("Pasta"), { target: { value: "D:\\Outra" } });
    expect(screen.queryByText("3 arquivos")).not.toBeInTheDocument();

    scanMock.mockResolvedValueOnce({ ok: false, error: "A pasta D:\\Outra não existe." });
    fireEvent.click(screen.getByRole("button", { name: "Procurar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não existe");
  });

  it("guarda pasta, máscara e operação, mas não senhas", async () => {
    scanMock.mockResolvedValue(SCAN);
    render(<PdfTools />);
    fireEvent.click(screen.getByRole("radio", { name: "Proteger" }));
    await searchFolder();
    fireEvent.change(screen.getByLabelText("Senha para abrir"), {
      target: { value: "segredo" },
    });

    const saved = localStorage.getItem("tools:pdf-tools") ?? "";
    expect(JSON.parse(saved)).toMatchObject({ operation: "protect", root: "D:\\Notas" });
    expect(saved).not.toContain("segredo");
  });
});
