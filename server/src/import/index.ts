// Сэтгэлийн Одод — тест файл импортлогч (диспетчер).
// contract.ts дахь гэрээг хэрэгжүүлнэ: экспортын нэр, гарын үсэг яг хэвээрээ.
// Файлын төрлийг өргөтгөлөөр (том/жижиг үсэг үл хамаарна) ялгаж
// тохирох парсер руу дамжуулна. Танигдахгүй төрөлд тодорхой Монгол
// алдаа шиднэ — хэзээ ч ерөнхий "Сүлжээний алдаа" биш.

import type { TestInput } from '../../../shared/src/types';
import { parseTestText } from './textParser';
import { parseDocx } from './docx';
import {
  parseCsv,
  parseDoc,
  parseEpub,
  parseHtml,
  parseJson,
  parseOdt,
  parsePdf,
  parsePptx,
  parseRtf,
  parseXlsx,
} from './office';
import { importImages } from './images';

export interface ImporterDeps {
  /** Зураг хадгалах хавтас (server/uploads). Файлын нэрийг буцаахдаа `/uploads/<нэр>` хэлбэрээр. */
  uploadsDir: string;
}

export interface ImageFileInput {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

function extensionOf(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff']);

export async function importTestFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  deps: ImporterDeps,
): Promise<TestInput> {
  const ext = extensionOf(fileName);
  if (IMAGE_EXTENSIONS.has(ext)) {
    return importImages([{ buffer, fileName, mimeType }], deps);
  }
  switch (ext) {
    case 'docx':
      return parseDocx(buffer, fileName, deps);
    case 'doc':
      return parseDoc(buffer, fileName);
    case 'txt':
    case 'md':
      return parseTestText(buffer.toString('utf8'), fileName);
    case 'csv':
      return parseCsv(buffer, fileName);
    case 'json':
      return parseJson(buffer, fileName);
    case 'pdf':
      return parsePdf(buffer, fileName);
    case 'xlsx':
    case 'xls':
      return parseXlsx(buffer, fileName);
    case 'pptx':
    case 'ppt':
      return parsePptx(buffer, fileName);
    case 'odt':
      return parseOdt(buffer, fileName);
    case 'rtf':
      return parseRtf(buffer, fileName);
    case 'html':
    case 'htm':
      return parseHtml(buffer, fileName);
    case 'epub':
      return parseEpub(buffer, fileName);
    default:
      throw new Error(`Энэ файлын төрөл дэмжигдэхгүй байна: ${ext || fileName}`);
  }
}

export async function importTestText(text: string, fileName: string): Promise<TestInput> {
  return parseTestText(text, fileName);
}

export async function importTestImages(
  files: ImageFileInput[],
  deps: ImporterDeps,
): Promise<TestInput> {
  return importImages(files, deps);
}
