import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 10;
const MAX_EXTRACTED_CHARACTERS = 20_000;
const PDF_RENDER_SCALE = 2;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_RENDER_PIXELS = 16_000_000;

function countCodePoints(value: string): number {
  return [...value.replace(/\r\n?/gu, '\n')].length;
}

export type EsInputSourceType = 'PNG' | 'JPEG' | 'PDF';
export type EsTextExtractionMethod = 'OCR' | 'PDF_TEXT' | 'PDF_TEXT_WITH_OCR';

export type EsTextExtractionResult = {
  sourceType: EsInputSourceType;
  extractionMethod: EsTextExtractionMethod;
  originalFilename: string;
  pageCount: number | null;
  extractedText: string;
  characterCount: number;
  requiresReview: true;
  warnings: string[];
};

export class EsTextExtractionError extends Error {
  readonly status: 413 | 415 | 422;
  readonly code: 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'VALIDATION_ERROR';

  constructor(
    status: 413 | 415 | 422,
    code: 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE' | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'EsTextExtractionError';
    this.status = status;
    this.code = code;
  }
}

type TrainedDataConfig = { code: string; langPath: string };

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectEsSourceType(bytes: Uint8Array): EsInputSourceType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'PNG';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'JPEG';
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'PDF';
  return null;
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+$/gu, ''))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function validateExtractedText(value: string): { text: string; count: number } {
  const text = normalizeExtractedText(value);
  const count = countCodePoints(text);
  if (count === 0) {
    throw new EsTextExtractionError(422, 'VALIDATION_ERROR', 'ファイルから文章を抽出できませんでした。');
  }
  if (count > MAX_EXTRACTED_CHARACTERS) {
    throw new EsTextExtractionError(422, 'VALIDATION_ERROR', '抽出した文章が20000文字を超えています。ファイルを分割してください。');
  }
  return { text, count };
}

function safeDisplayFilename(value: string): string {
  const name = basename(value.replaceAll('\\', '/')).trim() || 'upload';
  return [...name].slice(0, 255).join('');
}

async function prepareLocalTrainedData(directory: string): Promise<void> {
  const require = createRequire(import.meta.url);
  const configs = [
    require('@tesseract.js-data/jpn') as TrainedDataConfig,
    require('@tesseract.js-data/eng') as TrainedDataConfig,
  ];
  await mkdir(directory, { recursive: true });
  await Promise.all(configs.map((config) => copyFile(
    join(config.langPath, `${config.code}.traineddata.gz`),
    join(directory, `${config.code}.traineddata.gz`),
  )));
}

async function createLocalOcrWorker(directory: string): Promise<Worker> {
  await prepareLocalTrainedData(directory);
  const worker = await createWorker(['jpn', 'eng'], OEM.LSTM_ONLY, {
    langPath: directory,
    cachePath: directory,
    cacheMethod: 'none',
    gzip: true,
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });
  return worker;
}

async function recognize(worker: Worker, image: Buffer): Promise<string> {
  const result = await worker.recognize(image);
  return result.data.text;
}

async function textFromPdfPage(page: any): Promise<string> {
  const content = await page.getTextContent();
  let text = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    text += item.str;
    if (item.hasEOL) text += '\n';
  }
  return normalizeExtractedText(text);
}

async function importPdfJs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function renderPdfPage(page: any): Promise<Buffer> {
  const baseViewport = page.getViewport({ scale: 1 });
  const safeScale = Math.min(
    PDF_RENDER_SCALE,
    Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, baseViewport.width * baseViewport.height)),
  );
  const viewport = page.getViewport({ scale: safeScale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    canvas: null,
    viewport,
    background: '#ffffff',
  }).promise;
  return canvas.toBuffer('image/png');
}

async function extractPdf(
  bytes: Uint8Array,
  getWorker: () => Promise<Worker>,
): Promise<{ text: string; pageCount: number; usedOcr: boolean; warnings: string[] }> {
  const pdfjs = await importPdfJs();
  let document: any;
  try {
    document = await pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'PasswordException') {
      throw new EsTextExtractionError(422, 'VALIDATION_ERROR', 'パスワード付き・暗号化PDFには対応していません。');
    }
    throw new EsTextExtractionError(422, 'VALIDATION_ERROR', 'PDFが破損しているか、読み取れません。');
  }

  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new EsTextExtractionError(422, 'VALIDATION_ERROR', 'PDFは10ページ以内にしてください。');
    }
    const pageTexts: string[] = [];
    const warnings: string[] = [];
    let usedOcr = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const embeddedText = await textFromPdfPage(page);
      if (countCodePoints(embeddedText.replace(/\s/gu, '')) > 0) {
        pageTexts.push(embeddedText);
        continue;
      }
      usedOcr = true;
      const image = await renderPdfPage(page);
      const ocrText = normalizeExtractedText(await recognize(await getWorker(), image));
      pageTexts.push(ocrText);
      warnings.push(`PDFの${pageNumber}ページ目は画像としてOCRしました。内容を重点的に確認してください。`);
    }
    return { text: pageTexts.join('\n\n'), pageCount: document.numPages, usedOcr, warnings };
  } finally {
    await document.destroy();
  }
}

export async function extractEsText(file: File): Promise<EsTextExtractionResult> {
  if (file.size === 0) {
    throw new EsTextExtractionError(422, 'VALIDATION_ERROR', '空のファイルは処理できません。');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new EsTextExtractionError(413, 'PAYLOAD_TOO_LARGE', 'ファイルは10MB以内にしてください。');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sourceType = detectEsSourceType(bytes);
  if (!sourceType) {
    throw new EsTextExtractionError(415, 'UNSUPPORTED_MEDIA_TYPE', 'PNG、JPEG、PDFだけアップロードできます。');
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'polaris-ocr-'));
  let worker: Worker | undefined;
  const getWorker = async (): Promise<Worker> => {
    worker ??= await createLocalOcrWorker(temporaryDirectory);
    return worker;
  };

  try {
    if (sourceType === 'PDF') {
      const pdf = await extractPdf(bytes, getWorker);
      const validated = validateExtractedText(pdf.text);
      return {
        sourceType,
        extractionMethod: pdf.usedOcr ? 'PDF_TEXT_WITH_OCR' : 'PDF_TEXT',
        originalFilename: safeDisplayFilename(file.name),
        pageCount: pdf.pageCount,
        extractedText: validated.text,
        characterCount: validated.count,
        requiresReview: true,
        warnings: pdf.warnings,
      };
    }

    let image: Awaited<ReturnType<typeof loadImage>>;
    try {
      image = await loadImage(Buffer.from(bytes));
    } catch {
      throw new EsTextExtractionError(422, 'VALIDATION_ERROR', '画像が破損しているか、読み取れません。');
    }
    if (image.width * image.height > MAX_IMAGE_PIXELS) {
      throw new EsTextExtractionError(422, 'VALIDATION_ERROR', '画像の解像度が大きすぎます。4000万画素以内にしてください。');
    }
    const validated = validateExtractedText(await recognize(await getWorker(), Buffer.from(bytes)));
    return {
      sourceType,
      extractionMethod: 'OCR',
      originalFilename: safeDisplayFilename(file.name),
      pageCount: null,
      extractedText: validated.text,
      characterCount: validated.count,
      requiresReview: true,
      warnings: ['画像をOCRしました。誤認識や改行位置を確認してください。'],
    };
  } finally {
    if (worker) await worker.terminate();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
