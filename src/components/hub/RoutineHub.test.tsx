import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { RoutineHub } from "./RoutineHub";

afterEach(() => {
  history.replaceState(null, "", "/");
});

describe("<RoutineHub />", () => {
  it("lista as rotinas, abre uma e volta para a lista", async () => {
    const user = userEvent.setup();
    render(<RoutineHub />);

    await user.click(screen.getByRole("button", { name: /Olá Mundo/ }));
    expect(window.location.hash).toBe("#hello-world");
    expect(await screen.findByText("Olá, mundo!")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Rotinas/ }));
    expect(
      screen.getByRole("heading", { name: "Escolha uma rotina" }),
    ).toBeInTheDocument();
  });

  it("avisa quando o hash aponta para uma rotina inexistente", () => {
    history.replaceState(null, "", "/#nao-existe");
    render(<RoutineHub />);
    expect(screen.getByText(/"nao-existe" não existe/)).toBeInTheDocument();
  });
});
