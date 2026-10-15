import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Teleprompter from "./Teleprompter";

const SCRIPT = "Primeira linha do roteiro.\n\nSegundo parágrafo aqui.";

function currentLine() {
  return document.querySelector('[aria-current="true"]')?.textContent;
}

/** Quanto o texto já subiu (em em), lido do transform aplicado pela sessão. */
function trackOffset() {
  const track = document.querySelector('[aria-current="true"]')?.parentElement;
  const match = /translate3d\(0(?:px)?, (-?[\d.]+)em/.exec(track?.style.transform ?? "");
  return match ? -Number(match[1]) : 0;
}

/** Avança o relógio em passos, para os efeitos reagendarem temporizadores entre eles. */
function advance(ms: number, step = 100) {
  for (let elapsed = 0; elapsed < ms; elapsed += step)
    act(() => vi.advanceTimersByTime(step));
}

function renderWith(
  text: string,
  {
    countdown = 0,
    drive = "voice",
  }: { countdown?: number; drive?: "voice" | "speed" } = {},
) {
  localStorage.setItem(
    "tools:teleprompter",
    JSON.stringify({ text, speed: "normal", countdown, drive }),
  );
  return render(<Teleprompter />);
}

/** Relógio falso incluindo requestAnimationFrame (o laço de rolagem). */
function useFakeClock() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "Date",
    ],
  });
}

/** Reconhecimento de voz simulado: o teste "fala" com say(). */
class FakeRecognition {
  static instance: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    FakeRecognition.instance = this;
    queueMicrotask(() => this.onstart?.());
  }
  abort() {}
  say(transcript: string) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript } }] });
  }
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<Teleprompter /> — editor", () => {
  it("desabilita Iniciar com roteiro vazio e habilita ao digitar", () => {
    render(<Teleprompter />);
    const start = screen.getByRole("button", { name: "Iniciar" });
    expect(start).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Roteiro"), { target: { value: "Olá" } });
    expect(start).toBeEnabled();
  });

  it("Limpar exige confirmação", () => {
    renderWith(SCRIPT);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue(SCRIPT);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar limpeza" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue("");
  });

  it("persiste o roteiro no navegador", () => {
    render(<Teleprompter />);
    fireEvent.change(screen.getByLabelText("Roteiro"), { target: { value: "Salvo" } });
    expect(JSON.parse(localStorage.getItem("tools:teleprompter") ?? "{}").text).toBe(
      "Salvo",
    );
  });

  it("insere marcação de pausa no cursor", () => {
    render(<Teleprompter />);
    fireEvent.change(screen.getByLabelText("Roteiro"), { target: { value: "Olá" } });
    fireEvent.click(screen.getByRole("button", { name: "⏸ Pausa" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue("Olá [pausa 2]");
  });
});

describe("<Teleprompter /> — marcação automática", () => {
  it("Auto insere marcações e Desfazer restaura o texto", () => {
    renderWith(SCRIPT);
    fireEvent.click(screen.getByRole("button", { name: "✨ Auto" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue(
      "Primeira linha do roteiro. [pausa 2]\n\nSegundo parágrafo aqui.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("+1 marcação");

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue(SCRIPT);
  });

  it("apertar de novo remove todas as marcações, e Desfazer as traz de volta", () => {
    renderWith(`[sorria] ${SCRIPT}`);
    const toggle = screen.getByRole("button", { name: "✨ Remover marcações" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(screen.getByLabelText("Roteiro")).toHaveValue(SCRIPT);
    expect(screen.getByRole("status")).toHaveTextContent("−1 marcação");
    expect(screen.getByRole("button", { name: "✨ Auto" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "✨ Auto" }));
    fireEvent.click(screen.getByRole("button", { name: "✨ Remover marcações" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue(SCRIPT);

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByLabelText("Roteiro")).toHaveValue(
      "Primeira linha do roteiro. [pausa 2]\n\nSegundo parágrafo aqui.",
    );
  });

  it("avisa quando não há nada a sugerir", () => {
    renderWith("Tudo certo.");
    fireEvent.click(screen.getByRole("button", { name: "✨ Auto" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nada a sugerir");
  });
});

describe("<Teleprompter /> — apresentação por velocidade", () => {
  it("faz contagem regressiva e rola continuamente até o fim", () => {
    useFakeClock();
    renderWith(SCRIPT, { countdown: 2, drive: "speed" });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));

    expect(screen.getByText("2")).toBeInTheDocument();
    advance(2000);
    expect(currentLine()).toBe("Primeira linha do roteiro.");

    advance(1800);
    expect(currentLine()).toBe("Segundo parágrafo aqui.");

    advance(1500);
    expect(screen.getByText("Fim")).toBeInTheDocument();
  });

  it("Espaço pausa e continua; setas reposicionam; + acelera; Esc sai", () => {
    useFakeClock();
    renderWith(SCRIPT, { drive: "speed" });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    expect(currentLine()).toBe("Primeira linha do roteiro.");

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    advance(5000);
    expect(currentLine()).toBe("Primeira linha do roteiro.");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(currentLine()).toBe("Segundo parágrafo aqui.");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(currentLine()).toBe("Primeira linha do roteiro.");

    fireEvent.keyDown(window, { key: "+" });
    expect(screen.getByText("150 ppm")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByLabelText("Roteiro")).toBeInTheDocument();
  });

  it("mantém o texto já lido visível acima da linha atual", () => {
    renderWith(SCRIPT, { drive: "speed" });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    fireEvent.keyDown(window, { key: "ArrowDown" });

    const past = document.querySelector('[data-state="past"]');
    expect(past).toHaveTextContent("Primeira linha do roteiro.");
  });

  it("modo foco renderiza a apresentação fora da moldura da rotina", () => {
    const { container } = renderWith(SCRIPT, { countdown: 5, drive: "speed" });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar em modo foco" }));

    const region = screen.getByRole("region", { name: "Apresentação do teleprompter" });
    expect(container.contains(region)).toBe(false);
    expect(document.body.contains(region)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Encaixar" }));
    expect(container.contains(screen.getByRole("region"))).toBe(true);
  });
});

describe("<Teleprompter /> — seguir a voz", () => {
  beforeEach(() => {
    FakeRecognition.instance = null;
    Object.assign(window, { webkitSpeechRecognition: FakeRecognition });
  });
  afterEach(() => {
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });

  it("o texto acompanha as palavras ditas até o fim", async () => {
    useFakeClock();
    renderWith(SCRIPT);
    expect(screen.getByRole("radio", { name: "🎙 Voz" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    await act(async () => {});
    expect(screen.getByText("Ouvindo")).toBeInTheDocument();

    advance(2000);
    expect(currentLine()).toBe("Primeira linha do roteiro.");

    // O reconhecedor entrega a frase aos poucos, como o Chrome faz.
    act(() => FakeRecognition.instance?.say("primeira linha"));
    act(() => FakeRecognition.instance?.say("primeira linha do roteiro"));
    advance(1000);
    expect(currentLine()).toBe("Segundo parágrafo aqui.");

    act(() => FakeRecognition.instance?.say("segundo parágrafo aqui"));
    advance(1500);
    expect(screen.getByText("Fim")).toBeInTheDocument();
  });

  it("correção de hipótese provisória não faz o texto voltar", async () => {
    useFakeClock();
    renderWith(SCRIPT);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    await act(async () => {});

    act(() => FakeRecognition.instance?.say("primeira linha"));
    act(() => FakeRecognition.instance?.say("primeira linha do roteiro segundo"));
    advance(1500);
    const before = trackOffset();
    expect(before).toBeGreaterThan(0);

    // O reconhecedor revisa e "desdiz" a última palavra.
    act(() => FakeRecognition.instance?.say("primeira linha do roteiro"));
    advance(1500);
    expect(trackOffset()).toBeGreaterThanOrEqual(before);
  });

  it("microfone bloqueado oferece trocar para velocidade", async () => {
    renderWith(SCRIPT);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    await act(async () => {});

    act(() => FakeRecognition.instance?.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("bloqueou o microfone");

    fireEvent.click(screen.getByRole("button", { name: "Usar velocidade" }));
    expect(screen.getByText("140 ppm")).toBeInTheDocument();
  });
});
