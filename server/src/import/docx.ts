// Сэтгэлийн Одод — .docx парсер (Word хүснэгтийг хадгална).
// jszip + fast-xml-parser ашиглаж word/document.xml-ийг задлана.
// Хүснэгт: асуултын хүснэгт, онооны түлхүүрийн хүснэгт, үр дүнгийн мужны
// хүснэгтийг ялгаж авна. Хүснэгтийн гаднах дугаарласан догол мөрүүдийг
// parseTestText-ээр задлана. Ямар ч сүлжээ/AI ашигладаггүй.

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { ResultBand, TestInput, TestOption, TestQuestion, TestScale } from '../../../shared/src/types';
import type { ImporterDeps } from './index';
import {
  applyDefaultScores,
  extractOptionScore,
  genericBands,
  noOptionsError,
  NO_QUESTIONS_ERROR,
  parseBandLine,
  parseNumberList,
  parseScaleLine,
  parseTestText,
} from './textParser';

export const DOCX_READ_ERROR = 'Файлыг уншиж чадсангүй. .docx файл зөв эсэхийг шалгана уу';

// ---------- fast-xml-parser (preserveOrder) туслахууд ----------

type XmlNode = Record<string, unknown>;

function nodeTag(node: XmlNode): string {
  for (const key of Object.keys(node)) {
    if (key !== ':@') return key;
  }
  return '';
}

function nodeChildren(node: XmlNode): XmlNode[] {
  for (const key of Object.keys(node)) {
    if (key === ':@') continue;
    const v = node[key];
    if (Array.isArray(v)) return v as XmlNode[];
  }
  return [];
}

function findChildren(node: XmlNode, tag: string): XmlNode[] {
  return nodeChildren(node).filter((c) => nodeTag(c) === tag);
}

function findChild(node: XmlNode, tag: string): XmlNode | undefined {
  return findChildren(node, tag)[0];
}

function nodeAttr(node: XmlNode, name: string): string | undefined {
  const attrs = node[':@'] as Record<string, string> | undefined;
  return attrs?.[`@${name}`];
}

/** w:t доторх текстийг цуглуулна (w:tab → зай, w:br → шинэ мөр). */
function collectText(node: XmlNode): string {
  const tag = nodeTag(node);
  // fast-xml-parser нь дан тоон текстийг (ж.нь "2") тоо болгон задлах
  // тохиолдол байдаг тул '#text'-ийг үргэлж мөр болгон хувиргана.
  if (tag === '#text') {
    const v = node['#text'];
    return v === undefined || v === null ? '' : String(v);
  }
  if (tag === 'w:tab') return ' ';
  if (tag === 'w:br') return '\n';
  if (tag === 'w:t') return nodeChildren(node).map(collectText).join('');
  return nodeChildren(node).map(collectText).join('');
}

/** a:blip/@r:embed болон v:imagedata/@r:id утгуудыг цуглуулна. */
function collectImages(node: XmlNode, out: string[]): void {
  const tag = nodeTag(node);
  if (tag === 'a:blip') {
    const id = nodeAttr(node, 'r:embed');
    if (id) out.push(id);
  } else if (tag === 'v:imagedata') {
    const id = nodeAttr(node, 'r:id');
    if (id) out.push(id);
  }
  for (const c of nodeChildren(node)) collectImages(c, out);
}

// ---------- Баримтын бүтэц ----------

interface DocxParagraph {
  text: string;
  styleId?: string;
  images: string[];
}

interface DocxCell {
  /** Нүдэн дэх догол мөр бүрийн текст (хоосон мөр хасагдсан). */
  texts: string[];
  images: string[];
}

interface DocxTable {
  rows: DocxCell[][];
}

type Block = { kind: 'paragraph'; paragraph: DocxParagraph } | { kind: 'table'; table: DocxTable };

function cellText(cell: DocxCell): string {
  return cell.texts.join('\n');
}

function parseParagraph(pNode: XmlNode): DocxParagraph {
  let styleId: string | undefined;
  const pPr = findChild(pNode, 'w:pPr');
  if (pPr) {
    const pStyle = findChild(pPr, 'w:pStyle');
    if (pStyle) styleId = nodeAttr(pStyle, 'w:val');
  }
  const images: string[] = [];
  collectImages(pNode, images);
  return { text: collectText(pNode).trim(), styleId, images };
}

function parseTable(tblNode: XmlNode): DocxTable {
  const rows: DocxCell[][] = [];
  for (const tr of findChildren(tblNode, 'w:tr')) {
    const cells: DocxCell[] = [];
    for (const tc of findChildren(tr, 'w:tc')) {
      const paras = findChildren(tc, 'w:p').map(parseParagraph);
      const images: string[] = [];
      for (const p of paras) images.push(...p.images);
      cells.push({ texts: paras.map((p) => p.text).filter(Boolean), images });
    }
    rows.push(cells);
  }
  return { rows };
}

// ---------- Хамаарлууд (зураг) ----------

async function loadImageRels(zip: JSZip): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return map;
  try {
    const xml = await relsFile.async('string');
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml) as {
      Relationships?: { Relationship?: { '@_Id'?: string; '@_Type'?: string; '@_Target'?: string }[] | { '@_Id'?: string; '@_Type'?: string; '@_Target'?: string } };
    };
    const rels = parsed.Relationships?.Relationship;
    if (!rels) return map;
    const list = Array.isArray(rels) ? rels : [rels];
    for (const r of list) {
      if (r['@_Type']?.endsWith('/image') && r['@_Id'] && r['@_Target']) {
        map.set(r['@_Id'], r['@_Target'].replace(/^\//, ''));
      }
    }
  } catch {
    // Хамаарал уншигдахгүй бол зургийг алгасна — тест өөрөө бүтнэ.
  }
  return map;
}

// ---------- Хүснэгтийн ангилал ----------

const QUESTION_HEADER_WORDS = ['№', 'асуулт'];

function tableHasQuestionHeader(table: DocxTable): boolean {
  const first = table.rows[0];
  if (!first) return false;
  const text = first.map(cellText).join(' ').toLowerCase();
  return QUESTION_HEADER_WORDS.some((w) => text.includes(w));
}

function isBandTable(table: DocxTable): boolean {
  const rows = table.rows.filter((r) => r.length >= 2);
  if (rows.length === 0) return false;
  const matches = rows.filter((r) => /^\d+\s*[-–—]\s*\d+/.test(cellText(r[0]).trim()));
  return matches.length >= Math.max(1, Math.ceil(rows.length / 2));
}

function isScaleTable(table: DocxTable): boolean {
  const rows = table.rows.filter((r) => r.length >= 2 && r.length <= 4);
  if (rows.length === 0) return false;
  const firstText = rows[0].map((c) => cellText(c)).join(' ').toLowerCase();
  const hasHeader =
    firstText.includes('тийм') ||
    firstText.includes('үгүй') ||
    firstText.includes('хэмжүүр') ||
    firstText.includes('түлхүүр') ||
    firstText.includes('коэффициент') ||
    firstText.includes('нэр');
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) return false;
  const good = dataRows.filter((r) => {
    const name = cellText(r[0]).trim();
    if (!name || name === '№' || name.length < 2 || /^\d+$/.test(name)) return false;
    return r.slice(1).some((c) => /\d/.test(cellText(c)));
  });
  return good.length >= Math.max(1, Math.ceil(dataRows.length / 2));
}

function isQuestionTable(table: DocxTable): boolean {
  const rows = table.rows.filter((r) => r.length >= 2);
  if (rows.length === 0) return false;
  const hasHeader = tableHasQuestionHeader(table);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const numbered = dataRows.filter(
    (r) => /^\d+$/.test(cellText(r[0]).trim()) && cellText(r[1]).trim().length > 3,
  );
  return hasHeader || numbered.length >= 1;
}

// ---------- Хүснэгт → тест ----------

type ImageResolver = (embedId: string) => Promise<string | undefined>;

function splitOptionCell(cell: DocxCell): string[] {
  const parts: string[] = [];
  for (const line of cellText(cell).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // "Тийм/Үгүй" маягийн нэг нүдэн дэх хоёр сонголт.
    if (/^(тийм|үгүй)\s*\/\s*(тийм|үгүй)/i.test(trimmed)) {
      parts.push(...trimmed.split('/').map((s) => s.trim()).filter(Boolean));
    } else {
      parts.push(trimmed);
    }
  }
  return parts;
}

async function parseQuestionTable(
  table: DocxTable,
  resolveImage: ImageResolver,
): Promise<TestQuestion[]> {
  const rows = table.rows.filter((r) => r.length >= 2);
  const hasHeader = tableHasQuestionHeader(table);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const questions: TestQuestion[] = [];
  for (const row of dataRows) {
    const qText = cellText(row[1]).trim();
    if (!qText) continue;
    const options: TestOption[] = [];
    for (let ci = 2; ci < row.length; ci++) {
      const cell = row[ci];
      const parts = splitOptionCell(cell);
      parts.forEach((part, idx) => {
        const { text, score } = extractOptionScore(part);
        if (!text) return;
        const opt: TestOption = { text, score: score ?? 0 };
        if (idx === 0 && cell.images.length > 0) {
          // Зургийг дараа нь resolve хийнэ — энд түр хадгална.
          (opt as TestOption & { __embedId?: string }).__embedId = cell.images[0];
        }
        options.push(opt);
      });
    }
    const question: TestQuestion = {
      text: qText,
      options: options.length > 0 ? applyDefaultScores(options) : [
        { text: 'Тийм', score: 1 },
        { text: 'Үгүй', score: 0 },
      ],
    };
    // Асуултын нүдэн дэх зураг.
    if (row[1].images.length > 0) {
      question.image = await resolveImage(row[1].images[0]);
    }
    // Сонголтын зургийг resolve хийх.
    for (const opt of question.options) {
      const embedId = (opt as TestOption & { __embedId?: string }).__embedId;
      if (embedId) {
        opt.image = await resolveImage(embedId);
        delete (opt as TestOption & { __embedId?: string }).__embedId;
      }
    }
    questions.push(question);
  }
  return questions;
}

function parseBandTable(table: DocxTable): ResultBand[] {
  const bands: ResultBand[] = [];
  for (const row of table.rows) {
    if (row.length < 2) continue;
    const range = cellText(row[0]).trim();
    if (!/^\d+\s*[-–—]\s*\d+/.test(range)) continue;
    const rest = row
      .slice(1)
      .map(cellText)
      .join(' ')
      .trim();
    const band = parseBandLine(`${range}: ${rest}`);
    if (band) bands.push(band);
  }
  return bands;
}

function parseScaleTable(table: DocxTable): TestScale[] {
  const rows = table.rows.filter((r) => r.length >= 2);
  if (rows.length === 0) return [];
  let headerIdx = -1;
  let yesCol = 1;
  let noCol = 2;
  let coefCol = -1;
  const headerCells = rows[0].map((c) => cellText(c).toLowerCase());
  if (headerCells.some((t) => t.includes('тийм') || t.includes('yes'))) {
    headerIdx = 0;
    yesCol = headerCells.findIndex((t) => t.includes('тийм') || t.includes('yes'));
    const ni = headerCells.findIndex((t) => t.includes('үгүй') || t.includes('no'));
    noCol = ni >= 0 ? ni : -1;
    const ci = headerCells.findIndex(
      (t) => t.includes('коэффициент') || t.includes('k=') || t.trim() === 'k',
    );
    coefCol = ci >= 0 ? ci : -1;
  }
  const scales: TestScale[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = cellText(row[0]).trim();
    if (!name) continue;
    // 2 баганатай бол "Нэр: тийм 1, 5; үгүй 2, 6; коэффициент 2" хэлбэрээр оролдоно.
    if (row.length === 2) {
      const scale = parseScaleLine(`${name}: ${cellText(row[1])}`);
      if (scale) scales.push(scale);
      continue;
    }
    let yesItems = yesCol >= 0 && row[yesCol] ? parseNumberList(cellText(row[yesCol])) : [];
    let noItems = noCol >= 0 && row[noCol] ? parseNumberList(cellText(row[noCol])) : [];
    if (yesItems.length === 0 && noItems.length === 0) {
      const scale = parseScaleLine(
        `${name}: ${row.slice(1).map(cellText).join('; ')}`,
      );
      if (scale) scales.push(scale);
      continue;
    }
    let coefficient = 1;
    if (coefCol >= 0 && row[coefCol]) {
      const m = cellText(row[coefCol]).match(/(\d+(?:[.,]\d+)?)/);
      if (m) coefficient = parseFloat(m[1].replace(',', '.'));
    } else if (row.length > 3) {
      const t = cellText(row[3]).trim();
      if (/^\d+(?:[.,]\d+)?$/.test(t)) coefficient = parseFloat(t.replace(',', '.'));
    }
    const kInName = name.match(/(?:коэффициент|k)\s*=?\s*(\d+(?:[.,]\d+)?)/i);
    if (kInName) coefficient = parseFloat(kInName[1].replace(',', '.'));
    const cleanName = name
      .replace(/\s*(?:коэффициент|k)\s*=?\s*\d+(?:[.,]\d+)?/i, '')
      .trim();
    scales.push({ name: cleanName, yesItems, noItems, coefficient });
  }
  return scales;
}

// ---------- Үндсэн функц ----------

export async function parseDocx(
  buffer: Buffer,
  fileName: string,
  deps: ImporterDeps,
): Promise<TestInput> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(DOCX_READ_ERROR);
  }
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error(DOCX_READ_ERROR);

  let xml: string;
  try {
    xml = await docXmlFile.async('string');
  } catch {
    throw new Error(DOCX_READ_ERROR);
  }

  const rels = await loadImageRels(zip);
  const imageCache = new Map<string, string | undefined>();
  const resolveImage: ImageResolver = async (embedId) => {
    if (imageCache.has(embedId)) return imageCache.get(embedId);
    let url: string | undefined;
    const target = rels.get(embedId);
    if (target) {
      const file = zip.file(`word/${target}`) ?? zip.file(target);
      if (file) {
        try {
          const data = await file.async('nodebuffer');
          const ext = target.split('.').pop()?.toLowerCase() || 'png';
          const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'png';
          const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${safeExt}`;
          await fs.mkdir(deps.uploadsDir, { recursive: true });
          await fs.writeFile(path.join(deps.uploadsDir, name), data);
          url = `/uploads/${name}`;
        } catch {
          url = undefined;
        }
      }
    }
    imageCache.set(embedId, url);
    return url;
  };

  let parsed: unknown;
  try {
    const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true });
    parsed = parser.parse(xml);
  } catch {
    throw new Error(DOCX_READ_ERROR);
  }
  const docNode = (parsed as XmlNode[]).find((n) => nodeTag(n) === 'w:document');
  if (!docNode) throw new Error(DOCX_READ_ERROR);
  const body = findChild(docNode, 'w:body');
  if (!body) throw new Error(DOCX_READ_ERROR);

  // Биеийг дараалсан блокуудад хуваана: догол мөр + хүснэгт.
  const blocks: Block[] = [];
  for (const child of nodeChildren(body)) {
    const tag = nodeTag(child);
    if (tag === 'w:p') blocks.push({ kind: 'paragraph', paragraph: parseParagraph(child) });
    else if (tag === 'w:tbl') blocks.push({ kind: 'table', table: parseTable(child) });
  }

  const paragraphs = blocks
    .filter((b): b is { kind: 'paragraph'; paragraph: DocxParagraph } => b.kind === 'paragraph')
    .map((b) => b.paragraph);

  // Хүснэгтийн гаднах догол мөрүүдээс текст сэргээнэ (гарчиг/тайлбар/муж/хэмжүүрд).
  const paragraphText = paragraphs.map((p) => p.text).filter(Boolean).join('\n');

  let base: TestInput | null = null;
  try {
    base = parseTestText(paragraphText, fileName);
  } catch {
    base = null;
  }

  // Асуултуудыг БАРИМТЫН ДАРААЛЛААР нэгтгэнэ: догол мөр + хүснэгт холилдсон
  // файлд аль алиных нь асуулт орох ёстой (зөвхөн хүснэгт, эсвэл зөвхөн
  // догол мөр гэж ялгах нь асуулт алдагдахад хүргэнэ). Давхардсан асуултыг
  // хэвийнжүүлсэн текстээр нь хасна. Дарааллыг хадгалах нь хэмжүүрийн
  // түлхүүр (1-ээс эхэлсэн дугаар) зөв ажиллахад чухал.
  const tableScales: TestScale[] = [];
  const tableBands: ResultBand[] = [];
  const orderedQuestions: TestQuestion[] = [];
  let pendingParas: string[] = [];
  const flushParas = (): TestQuestion[] => {
    const text = pendingParas.filter(Boolean).join('\n');
    pendingParas = [];
    if (!text.trim()) return [];
    try {
      return parseTestText(text, fileName).questions;
    } catch {
      return [];
    }
  };
  for (const block of blocks) {
    if (block.kind === 'paragraph') {
      pendingParas.push(block.paragraph.text);
      continue;
    }
    const table = block.table;
    if (isBandTable(table)) {
      tableBands.push(...parseBandTable(table));
      continue;
    }
    // Асуултын хүснэгтийг хэмжүүрийн хүснэгтээс ЭХЛЭЭД шалгана: "№" толгойтой
    // асуултын хүснэгт хэмжүүрийн эвристикт (эхний нүд "№" + тоо агуулсан
    // багана) таарч буруу ангилагдах эрсдэлтэй.
    if (isQuestionTable(table)) {
      orderedQuestions.push(...flushParas());
      orderedQuestions.push(...(await parseQuestionTable(table, resolveImage)));
      continue;
    }
    if (isScaleTable(table)) {
      tableScales.push(...parseScaleTable(table));
      continue;
    }
    // Танигдахгүй хүснэгт — мөрүүдийг текст болгон нэмнэ.
    for (const row of table.rows) {
      const line = row.map(cellText).filter(Boolean).join(' ').trim();
      if (line) pendingParas.push(line);
    }
  }
  orderedQuestions.push(...flushParas());

  const seenQuestions = new Set<string>();
  const questions = orderedQuestions.filter((q) => {
    const key = q.text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || seenQuestions.has(key)) return false;
    seenQuestions.add(key);
    return true;
  });

  if (questions.length === 0) {
    throw new Error(NO_QUESTIONS_ERROR);
  }
  questions.forEach((q, idx) => {
    if (q.options.length < 2) throw new Error(noOptionsError(idx + 1));
  });

  // Догол мөр дэх зургийг асуултад холбох (хамгийн сайн оролдлого).
  for (const q of questions) {
    if (q.image) continue;
    const para = paragraphs.find(
      (p) =>
        p.images.length > 0 &&
        p.text.length > 0 &&
        (p.text.startsWith(q.text.slice(0, 30)) || q.text.startsWith(p.text.slice(0, 30))),
    );
    if (para) q.image = await resolveImage(para.images[0]);
  }

  const title =
    base?.title ??
    paragraphs.map((p) => p.text).find((t) => t.length > 0)?.replace(/^#{1,6}\s*/, '') ??
    fileName.replace(/\.[^.]+$/, '');
  const description = base?.description ?? '';
  const category = base?.category ?? 'Ерөнхий';

  const scales = tableScales.length > 0 ? tableScales : base?.scoring.scales ?? [];
  const maxScore = questions.reduce(
    (sum, q) => sum + Math.max(...q.options.map((o) => o.score), 0),
    0,
  );
  const countMax = maxScore > 0 ? maxScore : questions.length;
  const bands =
    tableBands.length > 0 ? tableBands : base?.scoring.bands ?? genericBands(countMax);

  return {
    title,
    description,
    category,
    questions,
    scoring:
      scales.length > 0 ? { mode: 'scales', scales, bands } : { mode: 'sum', bands },
    sourceFileName: fileName,
  };
}
