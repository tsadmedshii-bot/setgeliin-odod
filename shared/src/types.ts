// Сэтгэлийн Одод — клиент болон серверийн хооронд хуваалцдаг төрлүүд.
// API гэрээ: server/src/routes.ts болон client/src/api.ts энэ файлыг ашиглана.

export type Role = 'admin' | 'member';

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  createdAt: string;
}

export interface TestOption {
  text: string;
  image?: string | null;
  /** Энэ сонголтын оноо (нийлбэр болон түлхүүрт суурилсан оноонд хоёуланд хэрэглэнэ). */
  score: number;
}

export interface TestQuestion {
  text: string;
  image?: string | null;
  options: TestOption[];
}

/**
 * Түлхүүрт суурилсан хэмжүүр (жишээ нь Шмишек, MMPI маягийн тест):
 * yesItems — "Тийм" гэж хариулсан тохиолдолд тоологдох асуултын дугаар (1-ээс эхэлнэ);
 * noItems — "Үгүй" гэж хариулсан тохиолдолд тоологдох асуултын дугаар.
 * "Тийм" = тухайн асуултын эхний сонголт (ихэвчлэн score 1-тэй), "Үгүй" = хоёр дахь сонголт.
 * scaleScore = coefficient * (тоологдсон yesItems + тоологдсон noItems).
 */
export interface TestScale {
  name: string;
  yesItems: number[];
  noItems: number[];
  coefficient: number;
}

export interface ResultBand {
  /** Хаалттай муж: min <= оноо <= max. */
  min: number;
  max: number;
  title: string;
  description: string;
}

export interface TestScoring {
  mode: 'sum' | 'scales';
  /** mode === 'scales' үед заавал байна. */
  scales?: TestScale[];
  bands: ResultBand[];
}

export interface TestSummary {
  id: number;
  title: string;
  /** Тестийн зорилго / бүтэн тайлбар. */
  description: string;
  category: string;
  questionCount: number;
  priceMnt: number;
  published: boolean;
  attemptCount?: number;
  purchased?: boolean;
  sourceFileName?: string | null;
  createdAt: string;
}

export interface TestDetail extends TestSummary {
  questions: TestQuestion[];
}

/** Импортлогч болон seed-ээс үүсгэх тестийн оролт. */
export interface TestInput {
  title: string;
  description: string;
  category: string;
  questions: TestQuestion[];
  scoring: TestScoring;
  sourceFileName?: string;
}

export interface Purchase {
  id: number;
  testId: number;
  testTitle: string;
  amountMnt: number;
  status: 'pending' | 'paid';
  /** QPay тохируулагдсан эсэх. false бол "Би төлсөн" нь туршилтын баталгаа. */
  qpayConfigured: boolean;
  qrText?: string | null;
  qrImage?: string | null;
  urls?: string[];
}

export interface AttemptResult {
  id: number;
  testId: number;
  testTitle: string;
  score: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
  createdAt: string;
}

export interface QPaySettings {
  clientId: string;
  invoiceCode: string;
  merchantId: string;
  /** Нууц үг хадгалагдсан эсэх (утгыг нь хэзээ ч буцаадаггүй). */
  hasSecret: boolean;
  configured: boolean;
  source: 'env' | 'db' | 'none';
}

/** API алдаа: { error: "Монгол хэл дээрх тайлбар" } */
export interface ApiError {
  error: string;
}
