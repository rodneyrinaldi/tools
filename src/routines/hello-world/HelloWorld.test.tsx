import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import HelloWorld from "./HelloWorld";
import { buildGreeting } from "./greeting";

describe("buildGreeting", () => {
  it("cumprimenta o mundo quando o nome está vazio", () => {
    expect(buildGreeting("")).toBe("Olá, mundo!");
    expect(buildGreeting("   ")).toBe("Olá, mundo!");
  });

  it("cumprimenta pelo nome, sem espaços nas pontas", () => {
    expect(buildGreeting("  Ada ")).toBe("Olá, Ada!");
  });
});

describe("<HelloWorld />", () => {
  it("atualiza a saudação ao digitar e limpa ao clicar em Limpar", async () => {
    const user = userEvent.setup();
    render(<HelloWorld />);

    expect(screen.getByText("Olá, mundo!")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Seu nome"), "Ada");
    expect(screen.getByText("Olá, Ada!")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText("Olá, mundo!")).toBeInTheDocument();
  });
});
