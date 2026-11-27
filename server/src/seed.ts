// Сэтгэлийн Одод — демо тест оруулах seed скрипт.
// Хэрэглээ: npm run db:seed  (DATABASE_URL орчноос уншина; .env-ийг shell-ээр ачаална уу)
// tests хүснэгт хоосон үед л нэг DEMO тест оруулна.
import { count } from 'drizzle-orm';
import { db, pool } from './db';
import { tests } from './schema';
import type { TestQuestion, TestScoring } from '../../shared/src/types';

const DEMO_QUESTIONS: TestQuestion[] = [
  {
    text: 'Өнөөдөр таны сэтгэл санаа ямар байна?',
    options: [
      { text: 'Маш сайн', score: 3 },
      { text: 'Сайн', score: 2 },
      { text: 'Дунд зэрэг', score: 1 },
      { text: 'Муу', score: 0 },
    ],
  },
  {
    text: 'Сүүлийн 7 хоногт та хэр сайн унтаж байна вэ?',
    options: [
      { text: 'Маш сайн', score: 3 },
      { text: 'Сайн', score: 2 },
      { text: 'Муу', score: 1 },
      { text: 'Бараг унтаагүй', score: 0 },
    ],
  },
  {
    text: 'Та стресстэй үедээ өөрийгөө хэр тайвшруулж чаддаг вэ?',
    options: [
      { text: 'Амархан', score: 3 },
      { text: 'Ихэвчлэн', score: 2 },
      { text: 'Ховор', score: 1 },
      { text: 'Чадахгүй', score: 0 },
    ],
  },
];

const DEMO_SCORING: TestScoring = {
  mode: 'sum',
  bands: [
    {
      min: 0,
      max: 3,
      title: 'Амрах цаг болжээ',
      description:
        'Таны сэтгэл санаа одоогоор ачаалалтай байна. Өөртөө амрах цаг гаргаж, сайн унтаж, дотнын хүнтэйгээ ярилцаарай.',
    },
    {
      min: 4,
      max: 6,
      title: 'Тэнцвэртэй байна',
      description:
        'Таны сэтгэл санаа ерөнхийдөө тэнцвэртэй байна. Өдөр тутмын сайн зуршлаа хадгалаарай.',
    },
    {
      min: 7,
      max: 9,
      title: 'Сэтгэлийн тэнцвэр сайтай',
      description:
        'Таны сэтгэлийн тэнцвэр сайн түвшинд байна. Энэ байдлаа хадгалж, өөртөө анхаарлаа хандуулсаар байгаарай.',
    },
  ],
};

async function main(): Promise<void> {
  const rows = await db.select({ n: count() }).from(tests);
  const existing = Number(rows[0]?.n ?? 0);
  if (existing > 0) {
    console.log(`tests хүснэгтэд аль хэдийн ${existing} тест байна — seed алгасав.`);
    return;
  }
  // Асуултуудыг scoring JSONB дотор `questions` түлхүүрээр хамт хадгална (routes.ts-тай ижил гэрээ).
  await db.insert(tests).values({
    title: 'Сэтгэлийн тэнцвэр — жишээ тест (DEMO)',
    description:
      'Энэ бол системийг шалгах зориулалттай жишээ тест. Бодит оношилгоо биш — 3 асуулттай. Та өөрийн .docx файлуудаа админ самбараар оруулж, бодит тестүүдээ нэмнэ үү.',
    category: 'Ерөнхий',
    priceMnt: 6500,
    published: true,
    scoring: { ...DEMO_SCORING, questions: DEMO_QUESTIONS } as unknown as TestScoring,
    sourceFileName: 'DEMO',
  });
  console.log('DEMO тест орууллаа: "Сэтгэлийн тэнцвэр — жишээ тест (DEMO)".');
}

main()
  .catch((err) => {
    console.error('Seed амжилтгүй боллоо:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
