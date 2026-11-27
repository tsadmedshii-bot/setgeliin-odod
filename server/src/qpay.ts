// Сэтгэлийн Одод — QPay Merchant API (v2).
// Тохиргоо: QPAY_* орчны хувьсагч давуу эрхтэй, үгүй бол qpay_settings (id=1) мөр.
import { eq } from 'drizzle-orm';
import { db } from './db';
import { qpaySettings } from './schema';
import type { QPaySettings } from '../../shared/src/types';

const BASE_URL = (process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2').replace(/\/$/, '');

export interface QPayConfig {
  clientId: string;
  clientSecret: string;
  invoiceCode: string;
  merchantId: string;
  source: 'env' | 'db';
}

function envConfig(): QPayConfig | null {
  const clientId = process.env.QPAY_CLIENT_ID || '';
  const clientSecret = process.env.QPAY_CLIENT_SECRET || '';
  const invoiceCode = process.env.QPAY_INVOICE_CODE || '';
  const merchantId = process.env.QPAY_MERCHANT_ID || '';
  if (clientId && clientSecret && invoiceCode && merchantId) {
    return { clientId, clientSecret, invoiceCode, merchantId, source: 'env' };
  }
  return null;
}

/** Бүрэн тохиргоо байвал буцаана, дутуу бол null (туршилтын горим). */
export async function getQPayConfig(): Promise<QPayConfig | null> {
  const fromEnv = envConfig();
  if (fromEnv) return fromEnv;
  const rows = await db.select().from(qpaySettings).where(eq(qpaySettings.id, 1)).limit(1);
  const row = rows[0];
  if (row && row.clientId && row.clientSecret && row.invoiceCode && row.merchantId) {
    return {
      clientId: row.clientId,
      clientSecret: row.clientSecret,
      invoiceCode: row.invoiceCode,
      merchantId: row.merchantId,
      source: 'db',
    };
  }
  return null;
}

/** Админ самбарт харуулах төлөв — нууц утгыг хэзээ ч буцаадаггүй. */
export async function getQPayStatus(): Promise<QPaySettings> {
  const fromEnv = envConfig();
  if (fromEnv) {
    return {
      clientId: fromEnv.clientId,
      invoiceCode: fromEnv.invoiceCode,
      merchantId: fromEnv.merchantId,
      hasSecret: true,
      configured: true,
      source: 'env',
    };
  }
  const rows = await db.select().from(qpaySettings).where(eq(qpaySettings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) {
    return { clientId: '', invoiceCode: '', merchantId: '', hasSecret: false, configured: false, source: 'none' };
  }
  const configured = Boolean(row.clientId && row.clientSecret && row.invoiceCode && row.merchantId);
  return {
    clientId: row.clientId,
    invoiceCode: row.invoiceCode,
    merchantId: row.merchantId,
    hasSecret: Boolean(row.clientSecret),
    configured,
    source: 'db',
  };
}

async function qpayFetch(path: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (err) {
    throw new Error(`QPay серверт холбогдож чадсангүй: ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : text || `HTTP ${res.status}`;
    throw new Error(`QPay алдаа (${res.status}): ${msg}`);
  }
  return data;
}

async function getAccessToken(config: QPayConfig): Promise<string> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const data = (await qpayFetch('/auth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  })) as { access_token?: string };
  if (!data || !data.access_token) {
    throw new Error('QPay нэвтрэх токен авч чадсангүй');
  }
  return data.access_token;
}

export interface QPayInvoiceResult {
  invoiceId: string;
  qrText: string;
  qrImage: string;
  urls: string[];
}

/** Шинэ нэхэмжлэх үүсгэж QR мэдээлэл буцаана. */
export async function createQPayInvoice(
  amountMnt: number,
  description: string,
  senderInvoiceNo: string,
): Promise<QPayInvoiceResult> {
  const config = await getQPayConfig();
  if (!config) {
    throw new Error('QPay тохируулагдаагүй байна');
  }
  const token = await getAccessToken(config);
  const data = (await qpayFetch('/invoice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoice_code: config.invoiceCode,
      sender_invoice_no: senderInvoiceNo,
      invoice_receiver_code: config.invoiceCode,
      invoice_description: description,
      amount: amountMnt,
      callback_url: '',
    }),
  })) as {
    invoice_id?: string;
    qr_text?: string;
    qr_image?: string;
    urls?: Array<string | { link?: string; name?: string }>;
  };
  if (!data || !data.invoice_id) {
    throw new Error('QPay нэхэмжлэх үүсгэж чадсангүй');
  }
  const urls: string[] = Array.isArray(data.urls)
    ? data.urls
        .map((u) => (typeof u === 'string' ? u : u.link || u.name || ''))
        .filter((u) => u.length > 0)
    : [];
  return {
    invoiceId: data.invoice_id,
    qrText: data.qr_text || '',
    qrImage: data.qr_image || '',
    urls,
  };
}

/** Нэхэмжлэхийн төлбөрийг шалгаж, PAID төлбөрийн нийлбэр дүнг буцаана. */
export async function checkQPayPayment(
  invoiceId: string,
): Promise<{ paid: boolean; paidAmount: number }> {
  const config = await getQPayConfig();
  if (!config) {
    throw new Error('QPay тохируулагдаагүй байна');
  }
  const token = await getAccessToken(config);
  const data = (await qpayFetch('/payment/check', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_type: 'INVOICE',
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 10 },
    }),
  })) as { rows?: Array<{ payment_status?: string; payment_amount?: number | string }> };
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  let paidAmount = 0;
  for (const row of rows) {
    if (row.payment_status === 'PAID') {
      paidAmount += Number(row.payment_amount ?? 0) || 0;
    }
  }
  return { paid: paidAmount > 0, paidAmount };
}
