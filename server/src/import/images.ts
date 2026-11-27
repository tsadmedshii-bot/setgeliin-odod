// Сэтгэлийн Одод — зурагнаас (скан/зураг) тест импортлох (OCR).
// tesseract.js энэ төсөлд суулгагдаагүй тул динамик импорт нь
// бүтэлгүйтэх нь хүлээгдэж буй зүйл — тэр үед тодорхой Монгол
// алдааны мэдээ шиднэ (хэзээ ч ерөнхий "Сүлжээний алдаа" биш).
// Хэрэв tesseract.js суулгагдсан бол OCR (mon+eng) хийж текстийг
// parseTestText руу дамжуулна.

import type { TestInput } from '../../../shared/src/types';
import type { ImporterDeps } from './index';
import { parseTestText } from './textParser';

export const OCR_DISABLED_ERROR =
  'Зураг таних (OCR) энэ хувилбарт идэвхгүй байна. Зургийг текст болгон хувиргахын тулд tesseract.js суулгаж, OCR-г идэвхжүүлнэ үү.';

interface ImageFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export async function importImages(
  files: ImageFile[],
  _deps: ImporterDeps,
): Promise<TestInput> {
  if (!files || files.length === 0) {
    throw new Error(OCR_DISABLED_ERROR);
  }

  // tesseract.js суулгагдаагүй — энэ импорт бүтэлгүйтнэ.
  let tesseract: {
    createWorker: (langs: string) => Promise<{
      recognize: (image: Buffer) => Promise<{ data: { text: string } }>;
      terminate: () => Promise<void>;
    }>;
  };
  try {
    const specifier = 'tesseract.js';
    const mod = (await import(specifier)) as typeof tesseract & {
      default?: typeof tesseract;
    };
    tesseract = mod.default ?? mod;
    if (!tesseract || typeof tesseract.createWorker !== 'function') {
      throw new Error('tesseract.js ачаалагдсангүй');
    }
  } catch {
    throw new Error(OCR_DISABLED_ERROR);
  }

  let worker: Awaited<ReturnType<typeof tesseract.createWorker>> | null = null;
  try {
    worker = await tesseract.createWorker('mon+eng');
    const texts: string[] = [];
    for (const file of files) {
      const result = await worker.recognize(file.buffer);
      const text = result?.data?.text ?? '';
      if (text.trim()) texts.push(text);
    }
    const joined = texts.join('\n');
    if (!joined.trim()) throw new Error(OCR_DISABLED_ERROR);
    const firstName = files[0].fileName.replace(/\.[^.]+$/, '');
    return parseTestText(joined, firstName);
  } catch (err) {
    if (err instanceof Error && err.message === OCR_DISABLED_ERROR) throw err;
    // OCR ажиллах явцад алдаа гарвал мөн л тодорхой мэдээ өгнө.
    throw new Error(OCR_DISABLED_ERROR);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // terminate алдаа нь үр дүнд нөлөөлөхгүй.
      }
    }
  }
}
