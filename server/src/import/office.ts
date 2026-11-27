// Сэтгэлийн Одод — бусад форматын парсерууд (.doc, .pdf, .xlsx, .pptx,
// .odt, .rtf, .html, .epub, .csv, .json). Боломжтой бол текстийг гаргаж
// аваад parseTestText руу дамжуулна — асуулт/муж/хэмжүүрийн задралыг
// нэг газар төвлөрүүлнэ. Ямар ч сүлжээ/AI ашигладаггүй.

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import * as cheerio from 'cheerio';
import { parse as parseCsvSync } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';
import type { ResultBand, TestInput, TestQuestion, TestScale } from '../../../shared/src/types';
import {
  applyDefaultScores,
  extractOptionScore,
  genericBands,
  noOptionsError,
  NO_QUESTIONS_ERROR,
  parseBandLine,
  parseNumberList,
  parseTestText,
} from './textParser';

// pdf-parse болон word-extractor нь TypeScript төрөл дагалддаггүй тул
// require-ээр ачаалж, төрлийг нь тодорхой заана.
const pdfParse = require('pdf-parse') as (
  data: Buffer,
) => Promise<{ text: string }>;
const WordExtractor = require('word-extractor') as new () => {
  extract(buffer: Buffer): Promise<{ getBody(): string }>;
};

function baseName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? fileName;
  return name.replace(/\.[^.]+$/, '') || 'Тест';
}

function cellString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Мөрнүүдээс (col0 дугаар, col1 асуулт, col2+ сонголт) асуулт үүсгэнэ. */
function rowsToQuestions(rows: string[][]): TestQuestion[] {
  const questions: TestQuestion[] = [];
  for (const row of rows) {
    if (row.length < 2) continue;
    const qText = cellString(row[1]);
    if (!qText) continue;
    const options = row
      .slice(2)
      .map((c) => cellString(c))
      .filter(Boolean)
      .map((text) => {
        const { text: t, score } = extractOptionScore(text);
        return { text: t, score: score ?? 0 };
      });
    if (options.length === 0) continue;
    questions.push({ text: qText, options: applyDefaultScores(options) });
  }
  return questions;
}

function buildTestInput(
  title: string,
  questions: TestQuestion[],
  scales: TestScale[],
  bands: ResultBand[],
  fileName: string,
  description = '',
  category = 'Ерөнхий',
): TestInput {
  if (questions.length === 0) throw new Error(NO_QUESTIONS_ERROR);
  questions.forEach((q, idx) => {
    if (q.options.length < 2) throw new Error(noOptionsError(idx + 1));
  });
  const maxScore = questions.reduce(
    (sum, q) => sum + Math.max(...q.options.map((o) => o.score), 0),
    0,
  );
  const countMax = maxScore > 0 ? maxScore : questions.length;
  const finalBands = bands.length > 0 ? bands : genericBands(countMax);
  return {
    title,
    description,
    category,
    questions,
    scoring:
      scales.length > 0
        ? { mode: 'scales', scales, bands: finalBands }
        : { mode: 'sum', bands: finalBands },
    sourceFileName: fileName,
  };
}

/** Хүснэгтийн мөрүүдийг parseTestText ойлгох мөрүүд болгон хувиргана. */
function tableRowsToLines(rows: string[][]): string[] {
  const lines: string[] = [];
  rows.forEach((row, idx) => {
    const cells = row.map(cellString);
    if (cells.every((c) => !c)) return;
    const firstIsNum = /^\d+$/.test(cells[0] ?? '');
    if (firstIsNum && cells[1] && cells[1].length > 3 && cells.length >= 2) {
      lines.push(`${cells[0]}. ${cells[1]}`);
      const letters = ['а', 'б', 'в', 'г', 'д', 'е'];
      cells.slice(2).forEach((c, ci) => {
        if (c) lines.push(`${letters[ci] ?? '•'}) ${c}`);
      });
    } else {
      lines.push(cells.filter(Boolean).join(' '));
    }
  });
  return lines;
}

// ---------- .doc (Word 97-2003) ----------

export async function parseDoc(buffer: Buffer, fileName: string): Promise<TestInput> {
  let text: string;
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    text = doc.getBody();
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. .doc файл зөв эсэхийг шалгана уу');
  }
  return parseTestText(text, fileName);
}

// ---------- .pdf ----------

export async function parsePdf(buffer: Buffer, fileName: string): Promise<TestInput> {
  let text: string;
  try {
    const data = await pdfParse(buffer);
    text = data.text;
  } catch {
    throw new Error('PDF файлыг уншиж чадсангүй');
  }
  if (!text || !text.trim()) throw new Error('PDF файлыг уншиж чадсангүй');
  return parseTestText(text, fileName);
}

// ---------- .xlsx ----------

function parseScaleSheetRows(rows: (string | number)[][]): TestScale[] {
  const scales: TestScale[] = [];
  for (const rawRow of rows) {
    const row = rawRow.map(cellString);
    if (row.every((c) => !c)) continue;
    const first = row[0].toLowerCase();
    if (
      first.includes('нэр') ||
      first.includes('хэмжүүр') ||
      first.includes('түлхүүр') ||
      first.includes('тийм') ||
      first.includes('name') ||
      first.includes('scale')
    ) {
      continue; // толгой мөр
    }
    const name = row[0];
    if (!name) continue;
    const yesItems = parseNumberList(row[1] ?? '');
    const noItems = parseNumberList(row[2] ?? '');
    let coefficient = 1;
    const coefText = row[3] ?? '';
    const coefMatch = coefText.match(/(\d+(?:[.,]\d+)?)/);
    if (coefMatch) coefficient = parseFloat(coefMatch[1].replace(',', '.'));
    if (yesItems.length === 0 && noItems.length === 0) continue;
    scales.push({ name, yesItems, noItems, coefficient });
  }
  return scales;
}

function parseBandSheetRows(rows: (string | number)[][]): ResultBand[] {
  const bands: ResultBand[] = [];
  for (const rawRow of rows) {
    const row = rawRow.map(cellString);
    if (row.every((c) => !c)) continue;
    const first = row[0].toLowerCase();
    if (first.includes('муж') || first.includes('оноо') || first.includes('band') || first.includes('range')) {
      continue; // толгой мөр
    }
    // 4 багана: min | max | гарчиг | тайлбар
    if (/^\d+$/.test(row[0]) && /^\d+$/.test(row[1])) {
      bands.push({
        min: parseInt(row[0], 10),
        max: parseInt(row[1], 10),
        title: row[2] || '',
        description: row[3] || '',
      });
      continue;
    }
    // 3 багана: "0-10" | гарчиг | тайлбар
    const band = parseBandLine(`${row[0]}: ${row[1]}. ${row[2] ?? ''}`.trim());
    if (band) bands.push(band);
  }
  return bands;
}

export async function parseXlsx(buffer: Buffer, fileName: string): Promise<TestInput> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. .xlsx файл зөв эсэхийг шалгана уу');
  }
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) throw new Error(NO_QUESTIONS_ERROR);

  const scaleSheetName = sheetNames.find((n) => /түлхүүр|key|scale|хэмжүүр/i.test(n));
  const bandSheetName = sheetNames.find((n) => /үр дүн|band|муж/i.test(n));

  const scales: TestScale[] = [];
  const bands: ResultBand[] = [];
  if (scaleSheetName) {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[scaleSheetName], {
      header: 1,
      defval: '',
    });
    scales.push(...parseScaleSheetRows(rows));
  }
  if (bandSheetName) {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(workbook.Sheets[bandSheetName], {
      header: 1,
      defval: '',
    });
    bands.push(...parseBandSheetRows(rows));
  }

  // Эхний (түгээмэл нь цорын ганц) асуултын хуудас.
  const questionSheetName =
    sheetNames.find((n) => n !== scaleSheetName && n !== bandSheetName) ?? sheetNames[0];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(
    workbook.Sheets[questionSheetName],
    { header: 1, defval: '' },
  );
  const stringRows = rows.map((r) => r.map(cellString));
  // Толгой мөр (асуулт/question агуулсан) алгасах.
  const dataRows = stringRows.filter((r) => {
    const first = (r[0] ?? '').toLowerCase();
    const second = (r[1] ?? '').toLowerCase();
    return !(first.includes('асуулт') || first.includes('question') || second.includes('асуулт'));
  });
  const questions = rowsToQuestions(dataRows);
  if (questions.length > 0) {
    return buildTestInput(baseName(fileName), questions, scales, bands, fileName);
  }
  // Нөөц: бүх хуудсыг текст болгон задалж үзнэ.
  const text = stringRows.map((r) => r.filter(Boolean).join(' ')).join('\n');
  return parseTestText(text, fileName);
}

// ---------- .pptx ----------

export async function parsePptx(buffer: Buffer, fileName: string): Promise<TestInput> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. .pptx файл зөв эсэхийг шалгана уу');
  }
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10);
      return na - nb;
    });
  if (slideFiles.length === 0) throw new Error('Файлыг уншиж чадсангүй. .pptx файл зөв эсэхийг шалгана уу');
  const lines: string[] = [];
  for (const slideName of slideFiles) {
    const xml = await zip.file(slideName)!.async('string');
    // a:t гүйлтийн текстийг дарааллаар нь авна; догол мөр бүрийг шинэ мөр гэж үзнэ.
    const paragraphs = xml.split(/<\/a:p>/);
    for (const p of paragraphs) {
      const runs = [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      const text = runs.join('').trim();
      if (text) lines.push(text);
    }
  }
  return parseTestText(lines.join('\n'), fileName);
}

// ---------- .odt ----------

export async function parseOdt(buffer: Buffer, fileName: string): Promise<TestInput> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. .odt файл зөв эсэхийг шалгана уу');
  }
  const contentFile = zip.file('content.xml');
  if (!contentFile) throw new Error('Файлыг уншиж чадсангүй. .odt файл зөв эсэхийг шалгана уу');
  const xml = await contentFile.async('string');
  const parser = new XMLParser({ ignoreAttributes: true, preserveOrder: true, parseTagValue: false });
  const parsed = parser.parse(xml) as Record<string, unknown>[];
  const lines: string[] = [];

  const textOf = (node: Record<string, unknown>): string => {
    let out = '';
    const walk = (n: Record<string, unknown>): void => {
      for (const key of Object.keys(n)) {
        if (key === ':@') continue;
        const v = n[key];
        // Дан тоон текстийг ("2") fast-xml-parser тоо болгон задлах
        // тохиолдол байдаг тул үргэлж мөр болгон хувиргана.
        if (key === '#text' && v !== undefined && v !== null) out += String(v);
        else if (Array.isArray(v)) v.forEach((c) => walk(c as Record<string, unknown>));
      }
    };
    walk(node);
    return out;
  };

  const walk = (nodes: Record<string, unknown>[]): void => {
    for (const node of nodes) {
      const tag = Object.keys(node).find((k) => k !== ':@') ?? '';
      const children = (Object.values(node).find((v) => Array.isArray(v)) ?? []) as Record<
        string,
        unknown
      >[];
      if (tag === 'text:p' || tag === 'text:h') {
        const t = textOf(node).trim();
        if (t) lines.push(t);
      } else if (tag === 'table:table-row') {
        const cells: string[] = [];
        for (const cell of children) {
          const cellTag = Object.keys(cell).find((k) => k !== ':@') ?? '';
          if (cellTag === 'table:table-cell') cells.push(textOf(cell).trim());
        }
        if (cells.some(Boolean)) lines.push(...tableRowsToLines([cells]));
      } else {
        walk(children);
      }
    }
  };
  walk(parsed);
  return parseTestText(lines.join('\n'), fileName);
}

// ---------- .rtf ----------

export function rtfToText(rtf: string): string {
  // \uN юникод escape (сөрөг утгыг 65536 нэмнэ).
  let text = rtf.replace(/\\u(-?\d+)\??/g, (_m, code: string) => {
    let n = parseInt(code, 10);
    if (n < 0) n += 65536;
    return String.fromCharCode(n);
  });
  // \'xx hex escape — windows-1251 нэг байт гэж тайлна (Кирилл үсэг).
  const decoder = new TextDecoder('windows-1251');
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex: string) =>
    decoder.decode(new Uint8Array([parseInt(hex, 16)])),
  );
  // \par, \line → шинэ мөр.
  text = text.replace(/\\par[d]?\s?/g, '\n').replace(/\\line\s?/g, '\n');
  // Бусад хяналтын үгсийг арилгана.
  text = text.replace(/\\[a-zA-Z]+\-?\d*\s?/g, '');
  // Хаалтнуудыг арилгана.
  text = text.replace(/[{}]/g, '');
  // Олон хоосон мөрийг цөөлнө.
  return text.replace(/\n{3,}/g, '\n\n');
}

export async function parseRtf(buffer: Buffer, fileName: string): Promise<TestInput> {
  const rtf = buffer.toString('utf8');
  const text = rtfToText(rtf);
  return parseTestText(text, fileName);
}

// ---------- .html ----------

function cheerioToLines($: cheerio.CheerioAPI): string[] {
  const lines: string[] = [];
  $('h1, h2, h3, h4, p, li').each((_i, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t) lines.push(t);
  });
  // Хүснэгтүүдийг мөр мөрөөр нь нэмнэ.
  $('table tr').each((_i, tr) => {
    const cells: string[] = [];
    $(tr)
      .find('td, th')
      .each((_j, cell) => {
        cells.push($(cell).text().trim().replace(/\s+/g, ' '));
      });
    if (cells.some(Boolean)) lines.push(...tableRowsToLines([cells]));
  });
  return lines;
}

export async function parseHtml(buffer: Buffer, fileName: string): Promise<TestInput> {
  const html = buffer.toString('utf8');
  const $ = cheerio.load(html);
  const lines = cheerioToLines($);
  return parseTestText(lines.join('\n'), fileName);
}

// ---------- .epub ----------

export async function parseEpub(buffer: Buffer, fileName: string): Promise<TestInput> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. .epub файл зөв эсэхийг шалгана уу');
  }
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Файлыг уншиж чадсангүй. .epub файл зөв эсэхийг шалгана уу');
  const containerXml = await containerFile.async('string');
  const xmlParser = new XMLParser({ ignoreAttributes: false });
  const container = xmlParser.parse(containerXml) as {
    container?: { rootfiles?: { rootfile?: { '@_full-path'?: string } | { '@_full-path'?: string }[] } };
  };
  const rootfiles = container.container?.rootfiles?.rootfile;
  const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles;
  const opfPath = rootfile?.['@_full-path'];
  if (!opfPath) throw new Error('Файлыг уншиж чадсангүй. .epub файл зөв эсэхийг шалгана уу');
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('Файлыг уншиж чадсангүй. .epub файл зөв эсэхийг шалгана уу');
  const opfXml = await opfFile.async('string');
  const opf = xmlParser.parse(opfXml) as {
    package?: {
      manifest?: { item?: { '@_id'?: string; '@_href'?: string; '@_media-type'?: string }[] };
      spine?: { itemref?: { '@_idref'?: string }[] | { '@_idref'?: string } };
    };
  };
  const itemsRaw = opf.package?.manifest?.item;
  const items = itemsRaw ? (Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw]) : [];
  const itemById = new Map<string, string>();
  for (const item of items) {
    if (item['@_id'] && item['@_href']) itemById.set(item['@_id'], item['@_href']);
  }
  const spine = opf.package?.spine?.itemref;
  const spineRefs = spine ? (Array.isArray(spine) ? spine : [spine]) : [];
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const lines: string[] = [];
  for (const ref of spineRefs) {
    const href = ref['@_idref'] ? itemById.get(ref['@_idref']) : undefined;
    if (!href) continue;
    const chapterFile = zip.file(opfDir + href);
    if (!chapterFile) continue;
    const chapterHtml = await chapterFile.async('string');
    const $ = cheerio.load(chapterHtml);
    lines.push(...cheerioToLines($));
  }
  if (lines.length === 0) throw new Error(NO_QUESTIONS_ERROR);
  return parseTestText(lines.join('\n'), fileName);
}

// ---------- .csv ----------

export async function parseCsv(buffer: Buffer, fileName: string): Promise<TestInput> {
  let records: string[][];
  try {
    records = parseCsvSync(buffer.toString('utf8'), {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    }) as string[][];
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. .csv файл зөв эсэхийг шалгана уу');
  }
  const dataRows = records.filter((row) => {
    const first = (row[0] ?? '').toLowerCase();
    const second = (row[1] ?? '').toLowerCase();
    return !(
      first.includes('асуулт') ||
      first.includes('question') ||
      second.includes('асуулт') ||
      second.includes('question')
    );
  });
  const questions = rowsToQuestions(dataRows);
  if (questions.length > 0) {
    return buildTestInput(baseName(fileName), questions, [], [], fileName);
  }
  const text = records.map((r) => r.filter(Boolean).join(' ')).join('\n');
  return parseTestText(text, fileName);
}

// ---------- .json ----------

interface JsonOption {
  text?: unknown;
  score?: unknown;
  image?: unknown;
}

interface JsonQuestion {
  text?: unknown;
  image?: unknown;
  options?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function parseJson(buffer: Buffer, fileName: string): Promise<TestInput> {
  let data: unknown;
  try {
    data = JSON.parse(buffer.toString('utf8')) as unknown;
  } catch {
    throw new Error('Файлыг уншиж чадсангүй. JSON файл зөв эсэхийг шалгана уу');
  }
  if (!isRecord(data)) throw new Error('Файлыг уншиж чадсангүй. JSON файл зөв эсэхийг шалгана уу');

  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : baseName(fileName);
  const description = typeof data.description === 'string' ? data.description : '';
  const category = typeof data.category === 'string' && data.category.trim() ? data.category.trim() : 'Ерөнхий';

  const questions: TestQuestion[] = [];
  const rawQuestions = data.questions;
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error(NO_QUESTIONS_ERROR);
  }

  for (const rawQ of rawQuestions) {
    if (typeof rawQ === 'string') {
      // Хуучин хавтгай хэлбэр: ["асуулт", ...] → Тийм/Үгүй сонголт.
      questions.push({
        text: rawQ,
        options: [
          { text: 'Тийм', score: 1 },
          { text: 'Үгүй', score: 0 },
        ],
      });
      continue;
    }
    if (!isRecord(rawQ)) continue;
    const qText = typeof rawQ.text === 'string' ? rawQ.text.trim() : '';
    if (!qText) continue;
    const rawOptions = rawQ.options;
    if (!Array.isArray(rawOptions)) continue;
    const options = rawOptions
      .filter(isRecord)
      .map((o: JsonOption) => ({
        text: typeof o.text === 'string' ? o.text.trim() : '',
        score: typeof o.score === 'number' ? o.score : 0,
        ...(typeof o.image === 'string' ? { image: o.image } : {}),
      }))
      .filter((o) => o.text.length > 0);
    const question: TestQuestion = {
      text: qText,
      options: applyDefaultScores(options),
      ...(typeof rawQ.image === 'string' ? { image: rawQ.image } : {}),
    };
    questions.push(question);
  }

  if (questions.length === 0) throw new Error(NO_QUESTIONS_ERROR);
  questions.forEach((q, idx) => {
    if (q.options.length < 2) throw new Error(noOptionsError(idx + 1));
  });

  // scoring (хэрэв өгөгдсөн бол).
  let scales: TestScale[] = [];
  let bands: ResultBand[] = [];
  if (isRecord(data.scoring)) {
    const scoring = data.scoring as Record<string, unknown>;
    if (Array.isArray(scoring.scales)) {
      scales = (scoring.scales as unknown[])
        .filter(isRecord)
        .map((s) => ({
          name: typeof s.name === 'string' ? s.name : '',
          yesItems: Array.isArray(s.yesItems) ? (s.yesItems as unknown[]).filter((n) => typeof n === 'number') as number[] : [],
          noItems: Array.isArray(s.noItems) ? (s.noItems as unknown[]).filter((n) => typeof n === 'number') as number[] : [],
          coefficient: typeof s.coefficient === 'number' ? s.coefficient : 1,
        }))
        .filter((s) => s.name.length > 0);
    }
    if (Array.isArray(scoring.bands)) {
      bands = (scoring.bands as unknown[])
        .filter(isRecord)
        .map((b) => ({
          min: typeof b.min === 'number' ? b.min : 0,
          max: typeof b.max === 'number' ? b.max : 0,
          title: typeof b.title === 'string' ? b.title : '',
          description: typeof b.description === 'string' ? b.description : '',
        }))
        .filter((b) => b.title.length > 0);
    }
  }

  return buildTestInput(title, questions, scales, bands, fileName, description, category);
}
