/** Operações feitas em JavaScript com pdf-lib: juntar e converter para A4. */
import { degrees, PDFDocument, PageSizes } from "pdf-lib";

export class ProtectedPdfError extends Error {
  constructor() {
    super("O arquivo está protegido por senha. Use Desproteger antes.");
  }
}

async function load(bytes: Uint8Array) {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (error instanceof Error && /encrypt/i.test(error.message))
      throw new ProtectedPdfError();
    throw error;
  }
}

/** Une os documentos na ordem recebida. */
export async function mergePdfs(inputs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of inputs) {
    const source = await load(bytes);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4;

/**
 * Coloca cada página numa página A4 (retrato ou paisagem conforme a aparência da original),
 * escalando o conteúdo para caber, centralizado e respeitando a rotação da página.
 */
export async function convertToA4(input: Uint8Array): Promise<Uint8Array> {
  const source = await load(input);
  const output = await PDFDocument.create();

  for (const page of source.getPages()) {
    const embedded = await output.embedPage(page);
    const { width, height } = embedded;
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const sideways = rotation === 90 || rotation === 270;

    // Dimensões como a página aparece na tela.
    const visualWidth = sideways ? height : width;
    const visualHeight = sideways ? width : height;
    const landscape = visualWidth > visualHeight;
    const pageWidth = landscape ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = landscape ? A4_WIDTH : A4_HEIGHT;

    const scale = Math.min(pageWidth / visualWidth, pageHeight / visualHeight);
    const drawnWidth = width * scale;
    const drawnHeight = height * scale;
    const offsetX = (pageWidth - visualWidth * scale) / 2;
    const offsetY = (pageHeight - visualHeight * scale) / 2;

    // /Rotate gira no sentido horário; no desenho, ângulos positivos são anti-horários.
    // A âncora (x, y) é ajustada para o conteúdo girado ocupar a área centralizada.
    const anchor: Record<number, [number, number]> = {
      0: [offsetX, offsetY],
      90: [offsetX, offsetY + drawnWidth],
      180: [offsetX + drawnWidth, offsetY + drawnHeight],
      270: [offsetX + drawnHeight, offsetY],
    };
    const [x, y] = anchor[rotation] ?? anchor[0];

    output.addPage([pageWidth, pageHeight]).drawPage(embedded, {
      x,
      y,
      xScale: scale,
      yScale: scale,
      rotate: degrees(-rotation),
    });
  }

  return output.save();
}
