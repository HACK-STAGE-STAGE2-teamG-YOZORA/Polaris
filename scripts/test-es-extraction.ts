import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { detectEsSourceType, extractEsText } from '../src/server/es-text-extraction.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function imageWithText(text: string): Buffer {
  const canvas = createCanvas(1400, 260);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111111';
  context.font = 'bold 72px Arial';
  context.fillText(text, 50, 155);
  return canvas.toBuffer('image/png');
}

function blobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function textPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  page.drawText('Polaris entry sheet text PDF 2026', {
    x: 50,
    y: 760,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });
  return pdf.save();
}

async function imagePdf(image: Buffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const embedded = await pdf.embedPng(image);
  const page = pdf.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  return pdf.save();
}

const png = imageWithText('POLARIS OCR 2026');
assert(detectEsSourceType(png) === 'PNG', 'PNGシグネチャを検出できません。');
assert(detectEsSourceType(Buffer.from('not an image')) === null, '未対応ファイルを誤検出しました。');

const imageResult = await extractEsText(new File([blobPart(png)], 'entry.png', { type: 'application/octet-stream' }));
assert(imageResult.sourceType === 'PNG', '画像のsourceTypeが不正です。');
assert(imageResult.extractionMethod === 'OCR', '画像がOCR処理されませんでした。');
assert(/POLARIS/iu.test(imageResult.extractedText), '画像から文字を抽出できませんでした。');
assert(imageResult.requiresReview, '画像の本人確認が必須になっていません。');

const textPdfResult = await extractEsText(new File([blobPart(await textPdf())], 'entry-text.pdf', { type: 'image/png' }));
assert(textPdfResult.sourceType === 'PDF', '実データに基づくPDF判定ができません。');
assert(textPdfResult.extractionMethod === 'PDF_TEXT', '埋め込みPDFがテキスト抽出されませんでした。');
assert(textPdfResult.extractedText.includes('Polaris entry sheet text PDF 2026'), 'PDF埋め込みテキストが一致しません。');

const imagePdfResult = await extractEsText(new File([blobPart(await imagePdf(png))], 'entry-image.pdf', { type: 'application/pdf' }));
assert(imagePdfResult.extractionMethod === 'PDF_TEXT_WITH_OCR', '画像PDFがOCRへフォールバックしませんでした。');
assert(/POLARIS/iu.test(imagePdfResult.extractedText), '画像PDFから文字を抽出できませんでした。');
assert(imagePdfResult.warnings.length > 0, '画像PDFの確認警告がありません。');

console.log('ES local text extraction: OK');
