// Сэтгэлийн Одод — тодорхойлогч (deterministic) текст парсер.
// .txt/.md болон бусад бүх форматаас текст гаргаж авсны дараах
// нийтлэг зам. Ямар ч AI/дүгнэлт/сүлжээ ашигладаггүй — зөвхөн дүрмээр задлана.

import type { ResultBand, TestInput, TestOption, TestQuestion, TestScale } from '../../../shared/src/types';

export const NO_QUESTIONS_ERROR =
  'Файлаас асуулт олдсонгүй. Асуултуудаа дугаарлан бичнэ үү (1. Асуулт ...)';

export function noOptionsError(n: number): string {
  return `${n}-р асуултад сонголт олдсонгүй (хамгийн багадаа 2 сонголт хэрэгтэй)`;
}

const CYRILLIC_OPTION = /^[а-д]\)\s+(.+)$/i;
const LATIN_OPTION = /^[a-e]\)\s+(.+)$/i;
const NUMBERED_OPTION = /^(\d+)\)\s+(.+)$/;
const BULLET_OPTION = /^[-•*]\s+(.+)$/;

/** Асуулт эхэлж буй мөр: "1. ", "1) ", "№1", "Асуулт 1:" гэх мэт. */
const QUESTION_DOT = /^(\d+)\.\s+(.+)$/;
const QUESTION_NUM_SIGN = /^№\s*(\d+)[\.\)]?\s+(.+)$/;
const QUESTION_LABEL = /^Асуулт\s+(\d+)\s*[:\.\)]\s+(.+)$/i;

const BAND_SECTION = /^(Үр дүнгийн тайлбар|Үр дүн|Онооны тайлбар|Дүгнэлт)(?=$|[\s:])/i;
const SCALE_SECTION = /^(Хэмжүүр|Түлхүүр)(?=$|[\s:])/i;
const CATEGORY_LINE = /^Ангилал\s*:\s*(.+)$/i;
const DESCRIPTION_LABEL = /^(Тайлбар|Зорилго)\s*:\s*(.*)$/i;

function stripTitleHashes(line: string): string {
  return line.replace(/^#{1,6}\s*/, '').trim();
}

function baseName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? fileName;
  return name.replace(/\.[^.]+$/, '') || 'Тест';
}

export function parseNumberList(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+/g)) out.push(parseInt(m[0], 10));
  return out;
}

/**
 * Сонголтын мөрний төгсгөлөөс оноог салгана.
 * "(3 оноо)", "(3)", "[3]", "→ 3", "= 3", "3 оноо" хэлбэрүүдийг дэмжинэ.
 * Оноо олдоогүй бол score = null буцаана.
 */
export function extractOptionScore(raw: string): { text: string; score: number | null } {
  const text = raw.trim();
  const m = text.match(
    /\s*(?:\((\d+(?:[.,]\d+)?)\s*оноо?\)|\[(\d+(?:[.,]\d+)?)\]|→\s*(\d+(?:[.,]\d+)?)|=\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*оноо)\s*$/,
  );
  if (!m) return { text, score: null };
  const num = m.slice(1).find((g) => g !== undefined);
  const score = num ? parseFloat(num.replace(',', '.')) : null;
  return { text: text.slice(0, m.index).trim(), score };
}

/** "0-3: Гарчиг — тайлбар" / "0–3 оноо: Гарчиг. Тайлбар" мөр. */
export function parseBandLine(line: string): ResultBand | null {
  const m = line.trim().match(/^(\d+)\s*[-–—]\s*(\d+)\s*(?:оноо)?\s*[:\.]\s*(.+)$/);
  if (!m) return null;
  const rest = m[3].trim();
  // Гарчиг — тайлбар (em-dash) эсвэл Гарчиг. Тайлбар
  const dash = rest.indexOf('—');
  const dot = rest.indexOf('. ');
  let title = rest;
  let description = '';
  if (dash > 0) {
    title = rest.slice(0, dash).trim();
    description = rest.slice(dash + 1).trim();
  } else if (dot > 0) {
    title = rest.slice(0, dot).trim();
    description = rest.slice(dot + 2).trim();
  }
  if (!title) return null;
  return { min: parseInt(m[1], 10), max: parseInt(m[2], 10), title, description };
}

/** "Нэр: тийм 1, 5, 9; үгүй 2, 6; коэффициент 2" мөр. */
export function parseScaleLine(line: string): TestScale | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const name = line.slice(0, colon).trim();
  const rest = line.slice(colon + 1);
  if (!name || !rest.trim()) return null;
  const coefMatch = rest.match(/(?:коэффициент|k)\s*=?\s*(\d+(?:[.,]\d+)?)/i);
  const coefficient = coefMatch ? parseFloat(coefMatch[1].replace(',', '.')) : 1;
  const withoutCoef = rest.replace(/(?:коэффициент|k)\s*=?\s*\d+(?:[.,]\d+)?/gi, '');
  const yesMatch = withoutCoef.match(/тийм\s*[:\-]?\s*([\d,\s;]+)/i);
  const noMatch = withoutCoef.match(/үгүй\s*[:\-]?\s*([\d,\s;]+)/i);
  let yesItems: number[] = [];
  let noItems: number[] = [];
  if (yesMatch || noMatch) {
    yesItems = yesMatch ? parseNumberList(yesMatch[1]) : [];
    noItems = noMatch ? parseNumberList(noMatch[1]) : [];
  } else {
    // "тийм/үгүй" тэмдэглэгээгүй бол ";"-ээр салгасан хоёр хэсэг: эхнийх нь тийм, дараагийнх нь үгүй.
    const parts = withoutCoef.split(';').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      yesItems = parseNumberList(parts[0]);
      noItems = parseNumberList(parts[1]);
    } else {
      yesItems = parseNumberList(withoutCoef);
    }
  }
  if (yesItems.length === 0 && noItems.length === 0) return null;
  return { name, yesItems, noItems, coefficient };
}

export function genericBands(maxScore: number): ResultBand[] {
  const max = Math.max(maxScore, 1);
  const lowMax = Math.floor(max * 0.33);
  const midMax = Math.floor(max * 0.66);
  return [
    {
      min: 0,
      max: lowMax,
      title: 'Доод түвшин',
      description:
        'Энэ түвшин нь зөвхөн чиглүүлэх зорилготой бөгөөд эцсийн дүгнэлт биш юм. Нарийвчилсан тайлбарыг мэргэжилтнээс авна уу.',
    },
    {
      min: lowMax + 1,
      max: midMax,
      title: 'Дунд түвшин',
      description:
        'Энэ түвшин нь зөвхөн чиглүүлэх зорилготой бөгөөд эцсийн дүгнэлт биш юм. Нарийвчилсан тайлбарыг мэргэжилтнээс авна уу.',
    },
    {
      min: midMax + 1,
      max,
      title: 'Өндөр түвшин',
      description:
        'Энэ түвшин нь зөвхөн чиглүүлэх зорилготой бөгөөд эцсийн дүгнэлт биш юм. Нарийвчилсан тайлбарыг мэргэжилтнээс авна уу.',
    },
  ];
}

function isYesNoOptions(options: TestOption[]): boolean {
  if (options.length !== 2) return false;
  const first = options[0].text.trim().toLowerCase();
  const second = options[1].text.trim().toLowerCase();
  return first.startsWith('тийм') && second.startsWith('үгүй');
}

/** Сонголтуудад анхдагч оноо тавина: Тийм/Үгүй бол 1/0, үгүй бол дараалсан оноо хадгална. */
export function applyDefaultScores(options: TestOption[]): TestOption[] {
  const anyExplicit = options.some((o) => o.score !== 0);
  if (anyExplicit) return options;
  if (isYesNoOptions(options)) {
    return [
      { ...options[0], score: 1 },
      { ...options[1], score: 0 },
    ];
  }
  // Оноо заагдаагүй бусад тохиолдолд бүх сонголт 0 оноотой;
  // үр дүнгийн мужууд тооллогоор (асуултын тоогоор) тооцогдоно.
  return options;
}

type Section = 'body' | 'bands' | 'scales';

interface ParsedParts {
  title: string;
  description: string;
  category: string;
  questions: TestQuestion[];
  bands: ResultBand[];
  scales: TestScale[];
}

function matchQuestionStart(line: string): { num: number; text: string } | null {
  let m = line.match(QUESTION_LABEL);
  if (m) return { num: parseInt(m[1], 10), text: m[2].trim() };
  m = line.match(QUESTION_NUM_SIGN);
  if (m) return { num: parseInt(m[1], 10), text: m[2].trim() };
  m = line.match(QUESTION_DOT);
  if (m) return { num: parseInt(m[1], 10), text: m[2].trim() };
  return null;
}

function matchOption(line: string): string | null {
  let m = line.match(CYRILLIC_OPTION);
  if (m) return m[1].trim();
  m = line.match(LATIN_OPTION);
  if (m) return m[1].trim();
  m = line.match(BULLET_OPTION);
  if (m) return m[1].trim();
  return null;
}

export function parseTestText(text: string, fileName: string): TestInput {
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = rawLines.map((l) => l.trim());

  // --- Гарчиг: эхний хоосон бус мөр (Ангилал/Тайлбар мөр бол алгасна) ---
  let title = '';
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    if (CATEGORY_LINE.test(lines[i]) || DESCRIPTION_LABEL.test(lines[i])) continue;
    title = stripTitleHashes(lines[i]);
    titleIdx = i;
    break;
  }
  if (!title) title = baseName(fileName);

  const questions: TestQuestion[] = [];
  const bands: ResultBand[] = [];
  const scales: TestScale[] = [];
  const descriptionLines: string[] = [];
  let category = 'Ерөнхий';
  let section: Section = 'body';
  let current: TestQuestion | null = null;
  let currentNum = 0;
  let descriptionLabelled = false;

  const finishQuestion = () => {
    if (current) {
      current.options = applyDefaultScores(current.options);
      questions.push(current);
      current = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === titleIdx) continue;
    if (!line) continue;

    const cat = line.match(CATEGORY_LINE);
    if (cat) {
      category = cat[1].trim();
      continue;
    }

    if (BAND_SECTION.test(line)) {
      finishQuestion();
      section = 'bands';
      continue;
    }
    if (SCALE_SECTION.test(line)) {
      finishQuestion();
      section = 'scales';
      continue;
    }
    // Муж/хэмжүүрийн хэсгээс буцаж асуулт эхэлбэл бие рүү шилжинэ.
    if (section !== 'body' && matchQuestionStart(line)) {
      section = 'body';
    }

    if (section === 'bands') {
      const band = parseBandLine(line);
      if (band) bands.push(band);
      continue;
    }
    if (section === 'scales') {
      const scale = parseScaleLine(line);
      if (scale) scales.push(scale);
      continue;
    }

    // --- body ---
    const descLabel = line.match(DESCRIPTION_LABEL);
    if (!current && descLabel) {
      descriptionLabelled = true;
      if (descLabel[2]) descriptionLines.push(descLabel[2].trim());
      continue;
    }
    if (!current && descriptionLabelled && !matchQuestionStart(line) && !matchOption(line)) {
      descriptionLines.push(line);
      continue;
    }

    // Дугаарласан сонголт "1) ..." — асуултын доторх сонголт уу, шинэ асуулт уу?
    const numbered = line.match(NUMBERED_OPTION);
    if (numbered) {
      const n = parseInt(numbered[1], 10);
      if (current && current.options.length > 0) {
        // Сонголт аль хэдийн байгаа → дугаарласан сонголт.
        const { text: optText, score } = extractOptionScore(numbered[2]);
        current.options.push({ text: optText, score: score ?? 0 });
        continue;
      }
      if (current && current.options.length === 0 && n > currentNum) {
        // Дараалсан дугаар → шинэ асуулт.
        finishQuestion();
        current = { text: numbered[2].trim(), options: [] };
        currentNum = n;
        continue;
      }
      if (!current) {
        current = { text: numbered[2].trim(), options: [] };
        currentNum = n;
        continue;
      }
      // current байгаа, сонголтгүй, дугаар дараалсан биш → сонголт гэж үзнэ.
      const { text: optText, score } = extractOptionScore(numbered[2]);
      current.options.push({ text: optText, score: score ?? 0 });
      continue;
    }

    const q = matchQuestionStart(line);
    if (q) {
      finishQuestion();
      current = { text: q.text, options: [] };
      currentNum = q.num;
      continue;
    }

    const opt = matchOption(line);
    if (opt !== null && current) {
      const { text: optText, score } = extractOptionScore(opt);
      current.options.push({ text: optText, score: score ?? 0 });
      continue;
    }

    // Асуултын үргэлжлэл мөр (асуулт олон мөрөнд хуваагдсан) эсвэл тайлбар.
    if (current) {
      if (current.options.length === 0) {
        current.text = `${current.text} ${line}`.trim();
      } else {
        // Сонголтын үргэлжлэл мөр — сүүлчийн сонголт руу залгана.
        const last = current.options[current.options.length - 1];
        last.text = `${last.text} ${line}`.trim();
      }
    } else {
      descriptionLines.push(line);
    }
  }
  finishQuestion();

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

  const parts: ParsedParts = {
    title,
    description: descriptionLines.join(' ').replace(/\s+/g, ' ').trim(),
    category,
    questions,
    bands: finalBands,
    scales,
  };

  return {
    title: parts.title,
    description: parts.description,
    category: parts.category,
    questions: parts.questions,
    scoring:
      parts.scales.length > 0
        ? { mode: 'scales', scales: parts.scales, bands: parts.bands }
        : { mode: 'sum', bands: parts.bands },
    sourceFileName: fileName,
  };
}
