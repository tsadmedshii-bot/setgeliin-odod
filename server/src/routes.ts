// Сэтгэлийн Одод — /api чиглүүлэгч (бүх endpoint энд).
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from './db';
import { attempts, purchases, qpaySettings, tests, users } from './schema';
import type { AuthUser } from './auth';
import { createSession, deleteSession, HttpError, optionalAuth, registerUser, requireAdmin, requireAuth, verifyPassword } from './auth';
import { checkQPayPayment, createQPayInvoice, getQPayConfig, getQPayStatus } from './qpay';
import { scoreTest } from './scoring';
import { ensureUploadsDir, uploadImages, uploadSingle } from './uploads';
import { TEST_TEMPLATE } from './template';
import { importTestFile, importTestImages, importTestText } from './import/index';
import type {
  AttemptResult,
  Purchase,
  QPaySettings,
  Role,
  TestDetail,
  TestInput,
  TestQuestion,
  TestScoring,
  TestSummary,
  User,
} from '../../shared/src/types';

export const router = Router();

/**
 * АНХААР: tests хүснэгтэд асуултуудын тусдаа багана байхгүй тул
 * асуултуудыг scoring JSONB дотор `questions` түлхүүрээр хамт хадгалдаг.
 * Уншихдаа салгаж авна; оноо тооцоолохдоо scoring.mode/scales/bands л хэрэглэнэ.
 */
type StoredScoring = TestScoring & { questions?: TestQuestion[] };
type TestRow = typeof tests.$inferSelect;
type PurchaseRow = typeof purchases.$inferSelect;

function toIso(d: Date): string {
  return d.toISOString();
}

function publicUser(row: { id: number; name: string; username: string; role: string; createdAt: Date }): User {
  return { id: row.id, name: row.name, username: row.username, role: row.role as Role, createdAt: toIso(row.createdAt) };
}

function storedQuestions(row: TestRow): TestQuestion[] {
  const scoring = row.scoring as unknown as StoredScoring;
  return Array.isArray(scoring.questions) ? scoring.questions : [];
}

function storedScoring(row: TestRow): TestScoring {
  const { questions: _q, ...scoring } = row.scoring as unknown as StoredScoring;
  return scoring as TestScoring;
}

function toSummary(
  row: TestRow,
  opts: { attemptCount?: number; purchased?: boolean } = {},
): TestSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    questionCount: storedQuestions(row).length,
    priceMnt: row.priceMnt,
    published: row.published,
    attemptCount: opts.attemptCount,
    purchased: opts.purchased,
    sourceFileName: row.sourceFileName,
    createdAt: toIso(row.createdAt),
  };
}

function toDetail(row: TestRow, opts: { attemptCount?: number; purchased?: boolean } = {}): TestDetail {
  return { ...toSummary(row, opts), questions: storedQuestions(row) };
}

async function qpayConfiguredNow(): Promise<boolean> {
  return (await getQPayConfig()) !== null;
}

function toPurchase(
  row: PurchaseRow,
  testTitle: string,
  qpayConfigured: boolean,
  qr?: { qrText: string | null; qrImage: string | null; urls?: string[] },
): Purchase {
  // Шинээр үүсгэсэн QR байхгүй бол өмнө нь хадгалсан QR-г буцаана (0002 шилжилт).
  const effective =
    qr ??
    (row.qpayQrText || row.qpayQrImage
      ? { qrText: row.qpayQrText, qrImage: row.qpayQrImage, urls: undefined }
      : undefined);
  return {
    id: row.id,
    testId: row.testId,
    testTitle,
    amountMnt: row.amountMnt,
    status: row.status as 'pending' | 'paid',
    qpayConfigured,
    qrText: effective ? effective.qrText : null,
    qrImage: effective ? effective.qrImage : null,
    urls: effective?.urls,
  };
}

async function insertTest(input: TestInput): Promise<TestRow> {
  const scoringWithQuestions: StoredScoring = { ...input.scoring, questions: input.questions };
  const inserted = await db
    .insert(tests)
    .values({
      title: input.title,
      description: input.description ?? '',
      category: input.category ?? 'Ерөнхий',
      priceMnt: 6500,
      published: true,
      scoring: scoringWithQuestions as unknown as TestScoring,
      sourceFileName: input.sourceFileName ?? null,
    })
    .returning();
  return inserted[0];
}

async function loadTestOr404(id: number): Promise<TestRow> {
  const rows = await db.select().from(tests).where(eq(tests.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, 'Тест олдсонгүй');
  return rows[0];
}

async function loadPaidPurchase(userId: number, testId: number): Promise<PurchaseRow | null> {
  const rows = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.testId, testId)))
    .limit(1);
  const row = rows[0];
  return row && row.status === 'paid' ? row : null;
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;
function ah(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function parseId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Тест олдсонгүй');
  return id;
}

// ---------------------------------------------------------------- нэвтрэлт

router.post(
  '/auth/register',
  ah(async (req, res) => {
    const { name, username, password } = req.body ?? {};
    const user: AuthUser = await registerUser(String(name ?? ''), String(username ?? ''), String(password ?? ''));
    const token = await createSession(user.id);
    res.status(201).json({
      user: { id: user.id, name: user.name, username: user.username, role: user.role, createdAt: toIso(user.createdAt) },
      token,
    });
  }),
);

router.post(
  '/auth/login',
  ah(async (req, res) => {
    const { username, password } = req.body ?? {};
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, String(username ?? '')))
      .limit(1);
    const row = rows[0];
    const ok = row ? await verifyPassword(String(password ?? ''), row.passwordHash) : false;
    if (!row || !ok) {
      res.status(401).json({ error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна' });
      return;
    }
    const token = await createSession(row.id);
    res.json({ user: publicUser(row), token });
  }),
);

router.get('/auth/me', requireAuth, (req, res) => {
  const u = req.user as AuthUser;
  res.json({
    user: { id: u.id, name: u.name, username: u.username, role: u.role, createdAt: toIso(u.createdAt) },
  });
});

router.post(
  '/auth/logout',
  requireAuth,
  ah(async (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token) await deleteSession(token);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------- тестүүд

router.get(
  '/tests',
  optionalAuth,
  ah(async (req, res) => {
    const user = req.user;
    const isAdmin = user?.role === 'admin';
    const rows = isAdmin
      ? await db.select().from(tests).orderBy(desc(tests.createdAt), desc(tests.id))
      : await db
          .select()
          .from(tests)
          .where(eq(tests.published, true))
          .orderBy(desc(tests.createdAt), desc(tests.id));

    let attemptCounts = new Map<number, number>();
    if (isAdmin) {
      const grouped = await db
        .select({ testId: attempts.testId, n: count() })
        .from(attempts)
        .groupBy(attempts.testId);
      attemptCounts = new Map(grouped.map((g) => [g.testId, Number(g.n)]));
    }

    let paidTestIds = new Set<number>();
    if (user && !isAdmin) {
      const paid = await db
        .select({ testId: purchases.testId })
        .from(purchases)
        .where(and(eq(purchases.userId, user.id), eq(purchases.status, 'paid')));
      paidTestIds = new Set(paid.map((p) => p.testId));
    }

    res.json({
      tests: rows.map((row) =>
        toSummary(row, {
          attemptCount: isAdmin ? attemptCounts.get(row.id) ?? 0 : undefined,
          purchased: isAdmin ? true : paidTestIds.has(row.id),
        }),
      ),
    });
  }),
);

router.get(
  '/tests/:id',
  optionalAuth,
  ah(async (req, res) => {
    const id = parseId(req);
    const row = await loadTestOr404(id);
    const user = req.user;
    const isAdmin = user?.role === 'admin';
    if (!row.published && !isAdmin) {
      res.status(404).json({ error: 'Тест олдсонгүй' });
      return;
    }
    if (!isAdmin) {
      const paid = user ? await loadPaidPurchase(user.id, id) : null;
      if (!paid) {
        res.status(402).json({ error: 'Энэ тестийг өгөхөд төлбөр төлөх шаардлагатай', needsPayment: true, priceMnt: row.priceMnt });
        return;
      }
    }
    res.json({ test: toDetail(row, { purchased: true }) });
  }),
);

// ---------------------------------------------------------------- төлбөр

router.post(
  '/tests/:id/payment',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req);
    const user = req.user as AuthUser;
    const test = await loadTestOr404(id);
    if (!test.published && user.role !== 'admin') {
      res.status(404).json({ error: 'Тест олдсонгүй' });
      return;
    }
    const configured = await qpayConfiguredNow();

    const existingRows = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, user.id), eq(purchases.testId, id)))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      if (existing.status === 'paid') {
        res.json({ purchase: toPurchase(existing, test.title, configured) });
        return;
      }
      // Хүлээгдэж буй худалдан авалт байна: QPay тохируулагдсан атлаа нэхэмжлэхгүй бол үүсгэнэ.
      if (configured && !existing.qpayInvoiceId) {
        const senderNo = `SETG-${user.id}-${id}-${Date.now()}`;
        const invoice = await createQPayInvoice(test.priceMnt, test.title, senderNo);
        const updated = await db
          .update(purchases)
          .set({ qpayInvoiceId: invoice.invoiceId, qpayQrText: invoice.qrText, qpayQrImage: invoice.qrImage })
          .where(eq(purchases.id, existing.id))
          .returning();
        res.json({
          purchase: toPurchase(updated[0], test.title, true, {
            qrText: invoice.qrText,
            qrImage: invoice.qrImage,
            urls: invoice.urls,
          }),
        });
        return;
      }
      res.json({ purchase: toPurchase(existing, test.title, configured) });
      return;
    }

    let qpayInvoiceId: string | null = null;
    let qr: { qrText: string | null; qrImage: string | null; urls?: string[] } | undefined;
    if (configured) {
      const senderNo = `SETG-${user.id}-${id}-${Date.now()}`;
      const invoice = await createQPayInvoice(test.priceMnt, test.title, senderNo);
      qpayInvoiceId = invoice.invoiceId;
      qr = { qrText: invoice.qrText, qrImage: invoice.qrImage, urls: invoice.urls };
    }

    const inserted = await db
      .insert(purchases)
      .values({
        userId: user.id,
        testId: id,
        amountMnt: test.priceMnt,
        status: 'pending',
        qpayInvoiceId,
        qpayQrText: qr?.qrText ?? null,
        qpayQrImage: qr?.qrImage ?? null,
      })
      .onConflictDoNothing()
      .returning();
    let row = inserted[0];
    if (!row) {
      // Зэрэг хоёр хүсэлт ирсэн тохиолдолд аль хэдийн үүссэн мөрийг авна.
      const again = await db
        .select()
        .from(purchases)
        .where(and(eq(purchases.userId, user.id), eq(purchases.testId, id)))
        .limit(1);
      row = again[0];
    }
    res.status(201).json({ purchase: toPurchase(row, test.title, configured, qr) });
  }),
);

router.post(
  '/tests/:id/payment/confirm',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req);
    const user = req.user as AuthUser;
    const test = await loadTestOr404(id);
    const rows = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, user.id), eq(purchases.testId, id)))
      .limit(1);
    const purchase = rows[0];
    if (!purchase) {
      res.status(404).json({ error: 'Төлбөр олдсонгүй' });
      return;
    }
    if (purchase.status === 'paid') {
      res.json({ purchase: toPurchase(purchase, test.title, await qpayConfiguredNow()) });
      return;
    }
    if (purchase.qpayInvoiceId) {
      const check = await checkQPayPayment(purchase.qpayInvoiceId);
      if (check.paidAmount >= purchase.amountMnt) {
        const updated = await db
          .update(purchases)
          .set({ status: 'paid', paidAt: new Date() })
          .where(eq(purchases.id, purchase.id))
          .returning();
        res.json({ purchase: toPurchase(updated[0], test.title, true) });
        return;
      }
      res.status(402).json({
        error: 'Төлбөр бүрэн төлөгдөөгүй байна',
        purchase: toPurchase(purchase, test.title, true),
      });
      return;
    }
    // Нэхэмжлэхгүй (туршилтын горим): "Би төлсөн" нь тодорхой туршилтын баталгаа.
    const updated = await db
      .update(purchases)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(purchases.id, purchase.id))
      .returning();
    res.json({ purchase: toPurchase(updated[0], test.title, false) });
  }),
);

router.get(
  '/tests/:id/payment/check',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req);
    const user = req.user as AuthUser;
    const test = await loadTestOr404(id);
    const rows = await db
      .select()
      .from(purchases)
      .where(and(eq(purchases.userId, user.id), eq(purchases.testId, id)))
      .limit(1);
    const purchase = rows[0];
    if (!purchase) {
      res.status(404).json({ error: 'Төлбөр олдсонгүй' });
      return;
    }
    let current = purchase;
    const configured = await qpayConfiguredNow();
    if (purchase.qpayInvoiceId && purchase.status !== 'paid') {
      const check = await checkQPayPayment(purchase.qpayInvoiceId);
      if (check.paidAmount >= purchase.amountMnt) {
        const updated = await db
          .update(purchases)
          .set({ status: 'paid', paidAt: new Date() })
          .where(eq(purchases.id, purchase.id))
          .returning();
        current = updated[0];
      }
    }
    res.json({ purchase: toPurchase(current, test.title, configured), paid: current.status === 'paid' });
  }),
);

// ---------------------------------------------------------------- хариулт илгээх / үр дүн

router.post(
  '/tests/:id/submit',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req);
    const user = req.user as AuthUser;
    const test = await loadTestOr404(id);
    if (user.role !== 'admin') {
      const paid = await loadPaidPurchase(user.id, id);
      if (!paid) {
        res.status(402).json({
          error: 'Эхлээд төлбөрөө төлнө үү',
          needsPayment: true,
          priceMnt: test.priceMnt,
        });
        return;
      }
    }
    const answers = (req.body ?? {}).answers as number[];
    if (!Array.isArray(answers)) {
      res.status(400).json({ error: 'Хариулт илгээгдсэнгүй' });
      return;
    }
    const questions = storedQuestions(test);
    const scoring = storedScoring(test);
    const result = scoreTest(scoring, questions, answers);
    await db.insert(attempts).values({
      userId: user.id,
      testId: id,
      answers,
      score: result.score,
      maxScore: result.maxScore,
      resultTitle: result.resultTitle,
      resultDescription: result.resultDescription,
    });
    res.json({
      score: result.score,
      maxScore: result.maxScore,
      resultTitle: result.resultTitle,
      resultDescription: result.resultDescription,
    });
  }),
);

router.get(
  '/results',
  requireAuth,
  ah(async (req, res) => {
    const user = req.user as AuthUser;
    const rows = await db
      .select({
        id: attempts.id,
        testId: attempts.testId,
        testTitle: tests.title,
        score: attempts.score,
        maxScore: attempts.maxScore,
        resultTitle: attempts.resultTitle,
        resultDescription: attempts.resultDescription,
        createdAt: attempts.createdAt,
      })
      .from(attempts)
      .innerJoin(tests, eq(attempts.testId, tests.id))
      .where(eq(attempts.userId, user.id))
      .orderBy(desc(attempts.createdAt), desc(attempts.id));
    const results: AttemptResult[] = rows.map((r) => ({
      id: r.id,
      testId: r.testId,
      testTitle: r.testTitle,
      score: r.score,
      maxScore: r.maxScore,
      resultTitle: r.resultTitle,
      resultDescription: r.resultDescription,
      createdAt: toIso(r.createdAt),
    }));
    res.json({ results });
  }),
);

// ---------------------------------------------------------------- админ

router.get(
  '/admin/users',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const rows = await db.select().from(users).orderBy(users.id);
    res.json({ users: rows.map(publicUser) });
  }),
);

router.get('/template', requireAuth, requireAdmin, (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  // Файлын нэр зөвхөн ASCII байх ёстой (Node header-д кирилл үсэг зөвшөөрдөггүй).
  res.setHeader('Content-Disposition', 'attachment; filename="test-zagvar.txt"');
  res.send(TEST_TEMPLATE);
});

router.post(
  '/admin/tests/import',
  requireAuth,
  requireAdmin,
  uploadSingle,
  ah(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Файл сонгоно уу' });
      return;
    }
    const input = await importTestFile(req.file.buffer, req.file.originalname, req.file.mimetype, {
      uploadsDir: ensureUploadsDir(),
    });
    const row = await insertTest(input);
    res.status(201).json({ test: toSummary(row) });
  }),
);

router.post(
  '/admin/tests/import-text',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const { text, fileName } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Текст оруулна уу' });
      return;
    }
    const input = await importTestText(text, typeof fileName === 'string' && fileName ? fileName : 'paste.txt');
    const row = await insertTest(input);
    res.status(201).json({ test: toSummary(row) });
  }),
);

router.post(
  '/admin/tests/import-images',
  requireAuth,
  requireAdmin,
  uploadImages,
  ah(async (req, res) => {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length === 0) {
      res.status(400).json({ error: 'Зураг сонгоно уу' });
      return;
    }
    const input = await importTestImages(
      files.map((f) => ({ buffer: f.buffer, fileName: f.originalname, mimeType: f.mimetype })),
      { uploadsDir: ensureUploadsDir() },
    );
    const row = await insertTest(input);
    res.status(201).json({ test: toSummary(row) });
  }),
);

router.put(
  '/admin/tests/:id',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const id = parseId(req);
    const { title, description, category, priceMnt, published } = req.body ?? {};
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      res.status(400).json({ error: 'Тестийн гарчиг хоосон байж болохгүй' });
      return;
    }
    if (
      priceMnt !== undefined &&
      (!Number.isInteger(priceMnt) || priceMnt < 0 || priceMnt > 10000000)
    ) {
      res.status(400).json({ error: 'Үнэ 0–10,000,000₮ хооронд байх ёстой' });
      return;
    }
    await loadTestOr404(id);
    const patch: Partial<TestRow> = { updatedAt: new Date() };
    if (title !== undefined) patch.title = title.trim();
    if (description !== undefined) patch.description = String(description);
    if (category !== undefined) patch.category = String(category);
    if (priceMnt !== undefined) patch.priceMnt = priceMnt;
    if (published !== undefined) patch.published = Boolean(published);
    const updated = await db.update(tests).set(patch).where(eq(tests.id, id)).returning();
    res.json({ test: toSummary(updated[0]) });
  }),
);

router.delete(
  '/admin/tests/:id',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const id = parseId(req);
    await loadTestOr404(id);
    await db.delete(attempts).where(eq(attempts.testId, id));
    await db.delete(purchases).where(eq(purchases.testId, id));
    await db.delete(tests).where(eq(tests.id, id));
    res.json({ ok: true });
  }),
);

router.get(
  '/admin/qpay',
  requireAuth,
  requireAdmin,
  ah(async (_req, res) => {
    const settings: QPaySettings = await getQPayStatus();
    res.json({ settings });
  }),
);

router.put(
  '/admin/qpay',
  requireAuth,
  requireAdmin,
  ah(async (req, res) => {
    const { clientId, clientSecret, invoiceCode, merchantId } = req.body ?? {};
    const rows = await db.select().from(qpaySettings).where(eq(qpaySettings.id, 1)).limit(1);
    const existing = rows[0];
    const values = {
      id: 1,
      clientId: typeof clientId === 'string' ? clientId.trim() : existing?.clientId ?? '',
      clientSecret:
        typeof clientSecret === 'string' && clientSecret.length > 0
          ? clientSecret
          : existing?.clientSecret ?? '',
      invoiceCode: typeof invoiceCode === 'string' ? invoiceCode.trim() : existing?.invoiceCode ?? '',
      merchantId: typeof merchantId === 'string' ? merchantId.trim() : existing?.merchantId ?? '',
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(qpaySettings).set(values).where(eq(qpaySettings.id, 1));
    } else {
      await db.insert(qpaySettings).values(values);
    }
    const settings: QPaySettings = await getQPayStatus();
    res.json({ settings });
  }),
);

// ---------------------------------------------------------------- алдаа боловсруулалт

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Файл 20 MB-аас их байна' });
      return;
    }
    if (code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ error: 'Буруу файл талбар байна' });
      return;
    }
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Серверийн алдаа гарлаа' });
});
