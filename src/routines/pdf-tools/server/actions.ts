"use server";

/**
 * Server Actions da rotina. Leem e gravam no disco do computador, por isso só aceitam
 * requisições feitas a partir do próprio computador (host localhost).
 * Atenção: tudo que este arquivo exporta vira um endpoint — exporte só as ações.
 */
import { headers } from "next/headers";
import type { RunReport, RunRequest, ScanRequest, ScanResult } from "../operations";
import { isLocalHost } from "./local";
import { runOperation } from "./run";
import { scanFolder } from "./scan";
import { locateTools, toolsSummary } from "./tools";

async function assertLocal() {
  const requestHeaders = await headers();
  if (!isLocalHost(requestHeaders.get("host"))) {
    throw new Error("As ferramentas de PDF só funcionam com o app aberto em localhost.");
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Erro inesperado.";

export async function scanAction(request: ScanRequest): Promise<ScanResult> {
  try {
    await assertLocal();
    const [scan, paths] = await Promise.all([scanFolder(request), locateTools()]);
    return { ok: true, root: request.root.trim(), ...scan, tools: toolsSummary(paths) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function runAction(request: RunRequest): Promise<RunReport> {
  try {
    await assertLocal();
    return await runOperation(request);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
