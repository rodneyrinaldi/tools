"use client";

import { useEffect, useState } from "react";
import { Badge, Button, SegmentedControl, Surface, TextField, cx } from "@/design-system";
import { validateMask } from "./mask";
import { formatBytes } from "./naming";
import {
  buildSummary,
  COMPRESS_LEVELS,
  missingToolFor,
  OPERATIONS,
  validateOptions,
  type CompressLevel,
  type FileReport,
  type RunReport,
  type RunRequest,
  type ScanResult,
  type Tools,
} from "./operations";
import { runAction, scanAction } from "./server/actions";
import { loadPreferences, savePreferences, type Preferences } from "./storage";
import styles from "./PdfTools.module.css";

type Step = "setup" | "confirm" | "running" | "done";
type OkScan = Extract<ScanResult, { ok: true }>;
type OkReport = Extract<RunReport, { ok: true }>;

const MAX_LISTED = 300;

export default function PdfTools() {
  // A rotina só monta no cliente (lazy, após a hidratação): ler o storage aqui é seguro.
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [level, setLevel] = useState<CompressLevel>("medium");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<Step>("setup");
  const [report, setReport] = useState<RunReport | null>(null);

  useEffect(() => savePreferences(preferences), [preferences]);

  const { operation, root, recursive, mask } = preferences;
  const maskError = validateMask(mask);
  const found = scan?.ok ? scan : null;
  const fileCount = found ? found.pdfs.length + found.docx.length : 0;
  const missingTool = found ? missingToolFor(operation, found.tools) : null;
  const docxBlocked = found && found.docx.length > 0 && !found.tools.docx;
  const optionsError = found
    ? validateOptions(operation, fileCount, password, confirmation)
    : null;
  const canReview = Boolean(found) && !missingTool && !docxBlocked && !optionsError;

  const request: RunRequest = { root, recursive, mask, operation, level, password };

  function update(next: Partial<Preferences>) {
    setPreferences((previous) => ({ ...previous, ...next }));
    // Critérios de busca mudaram: a lista anterior deixa de valer.
    if ("root" in next || "recursive" in next || "mask" in next) setScan(null);
  }

  async function search() {
    setScanning(true);
    setScan(await scanAction({ root, recursive, mask }));
    setScanning(false);
  }

  async function execute() {
    setStep("running");
    setReport(await runAction(request));
    setStep("done");
  }

  function restart() {
    setStep("setup");
    setReport(null);
    setScan(null);
    setPassword("");
    setConfirmation("");
  }

  if (step === "confirm" && found) {
    return (
      <div className={styles.root}>
        <Surface variant="strong" padding="lg" className={styles.summary}>
          <h2 className={styles.heading}>Confirme o que será feito</h2>
          {buildSummary(request, found).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <FileList scan={found} compact />
        </Surface>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setStep("setup")}>
            Voltar
          </Button>
          <span className={styles.spacer} />
          <Button variant="primary" onClick={execute}>
            Confirmar e executar
          </Button>
        </div>
      </div>
    );
  }

  if (step === "running") {
    return (
      <div className={styles.root}>
        <Surface padding="lg" className={styles.running} aria-live="polite">
          <span className={styles.spinner} aria-hidden />
          <p>
            Processando {fileCount} {fileCount === 1 ? "arquivo" : "arquivos"}… Isso pode
            levar alguns minutos.
          </p>
        </Surface>
      </div>
    );
  }

  if (step === "done" && report) {
    return (
      <div className={styles.root}>
        {report.ok ? (
          <Report report={report} />
        ) : (
          <p className={styles.error}>{report.error}</p>
        )}
        <div className={styles.actions}>
          <span className={styles.spacer} />
          <Button variant="primary" onClick={restart}>
            Nova operação
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <section className={styles.section} aria-labelledby="pdf-step-1">
        <h2 id="pdf-step-1" className={styles.heading}>
          1. Operação
        </h2>
        <SegmentedControl
          label="O que fazer com os arquivos"
          options={OPERATIONS}
          value={operation}
          onChange={(next) => update({ operation: next })}
          className={styles.operations}
        />
      </section>

      <section className={styles.section} aria-labelledby="pdf-step-2">
        <h2 id="pdf-step-2" className={styles.heading}>
          2. Arquivos
        </h2>
        <form
          className={styles.searchForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!maskError && root.trim()) void search();
          }}
        >
          <TextField
            label="Pasta"
            hint="Onde estão os arquivos. Os resultados também serão gravados aqui (ao lado de cada original)."
            placeholder="D:\Documentos\Notas"
            value={root}
            onChange={(event) => update({ root: event.target.value })}
            className={styles.pathField}
            spellCheck={false}
          />
          <TextField
            label="Máscara"
            hint={maskError ?? "* qualquer texto, ? um caractere; separe várias com ;"}
            value={mask}
            onChange={(event) => update({ mask: event.target.value })}
            aria-invalid={Boolean(maskError)}
            className={styles.maskField}
            spellCheck={false}
          />
          <SegmentedControl
            label="Incluir subpastas"
            options={[
              { value: "no", label: "Não" },
              { value: "yes", label: "Sim" },
            ]}
            value={recursive ? "yes" : "no"}
            onChange={(value) => update({ recursive: value === "yes" })}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={scanning || Boolean(maskError) || !root.trim()}
            className={styles.searchButton}
          >
            {scanning ? "Procurando…" : "Procurar"}
          </Button>
        </form>

        {scan && !scan.ok && (
          <p className={styles.error} role="alert">
            {scan.error}
          </p>
        )}
        {found && <FileList scan={found} />}
        {found && (
          <ToolsNotice
            tools={found.tools}
            operation={operation}
            hasDocx={found.docx.length > 0}
          />
        )}
      </section>

      {found && fileCount > 0 && (
        <section className={styles.section} aria-labelledby="pdf-step-3">
          <h2 id="pdf-step-3" className={styles.heading}>
            3. Opções
          </h2>
          {operation === "compress" && (
            <SegmentedControl
              label="Nível de compressão"
              options={COMPRESS_LEVELS}
              value={level}
              onChange={setLevel}
            />
          )}
          {operation === "protect" && (
            <div className={styles.passwords}>
              <TextField
                label="Senha para abrir"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <TextField
                label="Confirme a senha"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
          )}
          {operation === "unprotect" && (
            <TextField
              label="Senha atual dos arquivos"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={styles.passwords}
            />
          )}
          {(operation === "merge" || operation === "a4") && (
            <p className={styles.muted}>
              {operation === "merge"
                ? "Os arquivos serão unidos na ordem da lista acima."
                : "Sem opções: cada página vai para A4, ajustada proporcionalmente."}
            </p>
          )}
        </section>
      )}

      <div className={styles.actions}>
        <span className={styles.problem} role="status">
          {found &&
            (missingTool ??
              (docxBlocked
                ? "Instale o Word ou o LibreOffice para converter os DOCX."
                : optionsError))}
        </span>
        <span className={styles.spacer} />
        <Button
          variant="primary"
          disabled={!canReview}
          onClick={() => setStep("confirm")}
        >
          Revisar e confirmar
        </Button>
      </div>
    </div>
  );
}

function FileList({ scan, compact = false }: { scan: OkScan; compact?: boolean }) {
  const entries = [
    ...scan.pdfs.map((file) => ({ ...file, docx: false })),
    ...scan.docx.map((file) => ({ ...file, docx: true })),
  ].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
  const total = entries.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className={styles.files}>
      <p className={styles.filesHeader} aria-live="polite">
        <strong>
          {entries.length} {entries.length === 1 ? "arquivo" : "arquivos"}
        </strong>{" "}
        · {formatBytes(total)}
        {scan.docx.length > 0 && ` · ${scan.docx.length} DOCX a converter`}
        {scan.ignored > 0 &&
          ` · ${scan.ignored} ${scan.ignored === 1 ? "gerado anteriormente ignorado" : "gerados anteriormente ignorados"}`}
      </p>
      {entries.length > 0 && (
        <ol className={cx(styles.fileList, compact && styles.fileListCompact)}>
          {entries.slice(0, MAX_LISTED).map((file) => (
            <li key={file.path} className={styles.fileItem}>
              <span className={styles.fileName} title={file.path}>
                {file.relativePath}
              </span>
              {file.docx && <Badge tone="accent">DOCX → PDF</Badge>}
              <span className={styles.fileSize}>{formatBytes(file.size)}</span>
            </li>
          ))}
          {entries.length > MAX_LISTED && (
            <li className={styles.muted}>… e mais {entries.length - MAX_LISTED}.</li>
          )}
        </ol>
      )}
    </div>
  );
}

const INSTALL = {
  qpdf: "winget install --id QPDF.QPDF -e",
  ghostscript: "choco install ghostscript -y",
};

function ToolsNotice({
  tools,
  operation,
  hasDocx,
}: {
  tools: Tools;
  operation: RunRequest["operation"];
  hasDocx: boolean;
}) {
  const items: { text: string; command?: string }[] = [];
  if (
    !tools.qpdf &&
    (operation === "protect" || operation === "unprotect" || operation === "compress")
  ) {
    items.push({
      text: "qpdf não encontrado (proteger, desproteger e compressão alternativa).",
      command: INSTALL.qpdf,
    });
  }
  if (!tools.ghostscript && operation === "compress") {
    items.push({
      text: "Ghostscript não encontrado (compressão de imagens, a mais eficiente).",
      command: INSTALL.ghostscript,
    });
  }
  if (hasDocx && !tools.docx) {
    items.push({
      text: "Nenhum conversor de DOCX encontrado: instale o Microsoft Word ou o LibreOffice.",
    });
  }
  if (items.length === 0) return null;

  return (
    <div className={styles.notice} role="note">
      <p>
        <strong>Ferramentas ausentes</strong> — instale num terminal como administrador e
        clique em Procurar de novo:
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.text}>
            {item.text}
            {item.command && <code className={styles.command}>{item.command}</code>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_BADGE = {
  ok: { tone: "success", label: "OK" },
  unchanged: { tone: "warning", label: "Sem alteração" },
  error: { tone: "danger", label: "Erro" },
} as const;

function Report({ report }: { report: OkReport }) {
  const all = [...report.conversions, ...report.results];
  const okCount = report.results.filter((r) => r.status === "ok").length;
  const errorCount = all.filter((r) => r.status === "error").length;
  const saved = report.results.reduce(
    (sum, r) =>
      r.status === "ok" && r.sizeBefore && r.sizeAfter
        ? sum + (r.sizeBefore - r.sizeAfter)
        : sum,
    0,
  );

  return (
    <Surface variant="strong" padding="lg" className={styles.summary}>
      <h2 className={styles.heading} aria-live="polite">
        Concluído: {okCount} {okCount === 1 ? "resultado" : "resultados"}
        {errorCount > 0 && `, ${errorCount} com erro`}
        {saved > 0 && ` · ${formatBytes(saved)} economizados`}
      </h2>
      {report.notes.map((note) => (
        <p key={note} className={styles.muted}>
          {note}
        </p>
      ))}
      {report.conversions.length > 0 && (
        <>
          <h3 className={styles.subheading}>Conversões DOCX → PDF</h3>
          <ReportList items={report.conversions} />
        </>
      )}
      <h3 className={styles.subheading}>Resultados</h3>
      <ReportList items={report.results} />
    </Surface>
  );
}

function ReportList({ items }: { items: FileReport[] }) {
  return (
    <ul className={styles.reportList}>
      {items.map((item, i) => {
        const badge = STATUS_BADGE[item.status];
        const change =
          item.sizeBefore && item.sizeAfter
            ? ` · ${formatBytes(item.sizeBefore)} → ${formatBytes(item.sizeAfter)} (${Math.round(
                ((item.sizeAfter - item.sizeBefore) / item.sizeBefore) * 100,
              )}%)`
            : "";
        return (
          <li key={`${item.source}-${i}`} className={styles.reportItem}>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <div className={styles.reportText}>
              <span className={styles.fileName}>{item.output ?? item.source}</span>
              <span className={item.status === "error" ? styles.errorText : styles.muted}>
                {item.message ?? (item.output ? `de ${item.source}` : "")}
                {change}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
