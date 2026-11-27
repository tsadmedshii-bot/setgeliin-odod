// Сэтгэлийн Одод — API клиент (same-origin; Vite dev нь /api болон /uploads-ийг
// localhost:3001 рүү proxy хийдэг).
import type {
  AttemptResult,
  Purchase,
  QPaySettings,
  TestDetail,
  TestSummary,
  User,
} from '../../shared/src/types';

const TOKEN_KEY = 'setgeliin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/** Серверийн алдаа: Mongolian { error } мессеж + HTTP статус. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (typeof opts.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    let message = 'Алдаа гарлаа. Дахин оролдоно уу.';
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
        message = (data as { error: string }).error;
      }
    } catch {
      // JSON биш алдааны хариулт — анхдагч мессежийг хэрэглэнэ.
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) };
}

/** Сервер заримдаа { key: [...] } хэлбэрээр, заримдаа шууд массив буцаадаг — хоёуланд нь ажиллана. */
function unwrapList<T>(data: T[] | { [key: string]: unknown }): T[] {
  if (Array.isArray(data)) return data;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function unwrapOne<T>(data: T | Record<string, T>): T {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const values = Object.values(data as Record<string, unknown>);
    if (values.length === 1 && values[0] && typeof values[0] === 'object') {
      return values[0] as T;
    }
  }
  return data as T;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ImportResult {
  message?: string;
  test?: TestSummary;
  tests?: TestSummary[];
}

export interface PaymentCheck {
  paid: boolean;
  purchase?: Purchase;
}

export interface QPayPatch {
  clientId?: string;
  clientSecret?: string;
  invoiceCode?: string;
  merchantId?: string;
}

export interface TestPatch {
  title?: string;
  description?: string;
  category?: string;
  priceMnt?: number;
  published?: boolean;
}

export async function register(name: string, username: string, password: string): Promise<User> {
  const data = await api<AuthResponse>('/api/auth/register', jsonBody({ name, username, password }));
  saveToken(data.token);
  return data.user;
}

export async function login(username: string, password: string): Promise<User> {
  const data = await api<AuthResponse>('/api/auth/login', jsonBody({ username, password }));
  saveToken(data.token);
  return data.user;
}

export function logout(): void {
  saveToken(null);
}

export async function me(): Promise<User> {
  const data = await api<User | { user: User }>('/api/auth/me');
  return 'user' in data ? data.user : data;
}

export async function listTests(): Promise<TestSummary[]> {
  const data = await api<TestSummary[] | { tests: TestSummary[] }>('/api/tests');
  return unwrapList(data);
}

export async function getTest(id: number): Promise<TestDetail> {
  const data = await api<TestDetail | { test: TestDetail }>(`/api/tests/${id}`);
  return unwrapOne(data);
}

export async function createPayment(testId: number): Promise<Purchase> {
  const data = await api<Purchase | { purchase: Purchase }>(`/api/tests/${testId}/payment`, { method: 'POST' });
  return unwrapOne(data);
}

export async function confirmPayment(testId: number): Promise<Purchase> {
  const data = await api<Purchase | { purchase: Purchase }>(`/api/tests/${testId}/payment/confirm`, { method: 'POST' });
  return unwrapOne(data);
}

export async function checkPayment(testId: number): Promise<PaymentCheck> {
  return api<PaymentCheck>(`/api/tests/${testId}/payment/check`);
}

export interface SubmitResult {
  score: number;
  maxScore: number;
  resultTitle: string;
  resultDescription: string;
}

export async function submitAnswers(testId: number, answers: number[]): Promise<SubmitResult> {
  return api<SubmitResult>(`/api/tests/${testId}/submit`, jsonBody({ answers }));
}

export async function myResults(): Promise<AttemptResult[]> {
  const data = await api<AttemptResult[] | { results: AttemptResult[] }>('/api/results');
  return unwrapList(data);
}

export async function adminListUsers(): Promise<User[]> {
  const data = await api<User[] | { users: User[] }>('/api/admin/users');
  return unwrapList(data);
}

export async function downloadTemplate(): Promise<void> {
  // Загвар татах нь админ эрх шаарддаг тул Authorization толгойтой fetch хийж
  // blob болгон татна (window.open нь токен дамжуулахгүй).
  const token = getToken();
  const res = await fetch('/api/template', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = 'Загвар татахад алдаа гарлаа.';
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
        message = (data as { error: string }).error;
      }
    } catch {
      // JSON биш хариулт — анхдагч мессеж.
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test загвар.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function adminImportFile(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  return api<ImportResult>('/api/admin/tests/import', { method: 'POST', body: form });
}

export async function adminImportText(text: string, fileName?: string): Promise<ImportResult> {
  return api<ImportResult>('/api/admin/tests/import-text', jsonBody({ text, fileName }));
}

export async function adminImportImages(files: File[]): Promise<ImportResult> {
  const form = new FormData();
  for (const file of files) {
    form.append('images', file);
  }
  return api<ImportResult>('/api/admin/tests/import-images', { method: 'POST', body: form });
}

export async function adminUpdateTest(id: number, patch: TestPatch): Promise<TestSummary> {
  const data = await api<TestSummary | { test: TestSummary }>(`/api/admin/tests/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  return unwrapOne(data);
}

export async function adminDeleteTest(id: number): Promise<void> {
  await api<void>(`/api/admin/tests/${id}`, { method: 'DELETE' });
}

export async function adminGetQpay(): Promise<QPaySettings> {
  const data = await api<QPaySettings | { settings: QPaySettings }>('/api/admin/qpay');
  return unwrapOne(data);
}

export async function adminSaveQpay(patch: QPayPatch): Promise<QPaySettings> {
  const data = await api<QPaySettings | { settings: QPaySettings }>('/api/admin/qpay', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  return unwrapOne(data);
}
