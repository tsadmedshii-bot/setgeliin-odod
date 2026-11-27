import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { QPaySettings, TestSummary, User } from '../../../shared/src/types';
import {
  ApiError,
  adminDeleteTest,
  adminGetQpay,
  adminImportFile,
  adminImportImages,
  adminImportText,
  adminListUsers,
  adminSaveQpay,
  adminUpdateTest,
  downloadTemplate,
  listTests,
} from '../api';

type Tab = 'tests' | 'import' | 'users' | 'qpay';

interface FileStatus {
  name: string;
  state: 'uploading' | 'done' | 'error';
  message: string;
}

const ACCEPT =
  '.docx,.doc,.txt,.md,.csv,.json,.pdf,.xlsx,.pptx,.odt,.rtf,.html,.epub,.jpg,.png,.jpeg';
const IMAGE_EXT = ['.jpg', '.jpeg', '.png'];

function isImageFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return IMAGE_EXT.some((ext) => lower.endsWith(ext));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('mn-MN');
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('tests');
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [qpay, setQpay] = useState<QPaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [editing, setEditing] = useState<TestSummary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('6500');
  const [editBusy, setEditBusy] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qpayClientId, setQpayClientId] = useState('');
  const [qpaySecret, setQpaySecret] = useState('');
  const [qpayInvoiceCode, setQpayInvoiceCode] = useState('');
  const [qpayMerchantId, setQpayMerchantId] = useState('');
  const [qpayBusy, setQpayBusy] = useState(false);

  const refreshTests = useCallback(async () => {
    setTests(await listTests());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listTests(), adminListUsers(), adminGetQpay()])
      .then(([t, u, q]) => {
        if (cancelled) return;
        setTests(t);
        setUsers(u);
        setQpay(q);
        setQpayClientId(q.clientId);
        setQpayInvoiceCode(q.invoiceCode);
        setQpayMerchantId(q.merchantId);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Админ мэдээлэл ачааллахад алдаа гарлаа.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startEdit(test: TestSummary) {
    setEditing(test);
    setEditTitle(test.title);
    setEditDescription(test.description);
    setEditCategory(test.category);
    setEditPrice(String(test.priceMnt));
    setMessage('');
    setError('');
  }

  async function saveEdit() {
    if (!editing) return;
    const price = Number(editPrice);
    if (!editTitle.trim()) {
      setError('Тестийн гарчиг оруулна уу.');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      setError('Үнэ буруу байна.');
      return;
    }
    setEditBusy(true);
    setError('');
    try {
      await adminUpdateTest(editing.id, {
        title: editTitle.trim(),
        description: editDescription,
        category: editCategory.trim() || 'Ерөнхий',
        priceMnt: price,
      });
      await refreshTests();
      setEditing(null);
      setMessage('Тест шинэчлэгдлээ.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Хадгалахад алдаа гарлаа.');
    } finally {
      setEditBusy(false);
    }
  }

  async function togglePublished(test: TestSummary) {
    setError('');
    try {
      await adminUpdateTest(test.id, { published: !test.published });
      await refreshTests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Төлөв өөрчлөхөд алдаа гарлаа.');
    }
  }

  async function deleteTest(test: TestSummary) {
    if (!window.confirm('Энэ тестийг устгахдаа итгэлтэй байна уу?')) return;
    setError('');
    try {
      await adminDeleteTest(test.id);
      await refreshTests();
      setMessage('Тест устгагдлаа.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Устгахад алдаа гарлаа.');
    }
  }

  function onFilesChange(e: ChangeEvent<HTMLInputElement>) {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
    setFileStatuses([]);
    setMessage('');
    setError('');
  }

  async function handleUpload() {
    if (files.length === 0) {
      setError('Эхлээд файл сонгоно уу.');
      return;
    }
    setImportBusy(true);
    setError('');
    setMessage('');
    const statuses: FileStatus[] = files.map((f) => ({ name: f.name, state: 'uploading', message: 'Оруулж байна...' }));
    setFileStatuses(statuses);

    const images = files.filter(isImageFile);
    const docs = files.filter((f) => !isImageFile(f));

    const updateStatus = (name: string, state: FileStatus['state'], message: string) => {
      setFileStatuses((prev) => prev.map((s) => (s.name === name ? { ...s, state, message } : s)));
    };

    try {
      if (images.length > 0) {
        const label = images.map((f) => f.name).join(', ');
        try {
          const res = await adminImportImages(images);
          const msg = res.message ?? (res.test ? `Тест үүслээ: ${res.test.title}` : 'Зурагнаас тест үүслээ.');
          for (const f of images) updateStatus(f.name, 'done', msg);
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : 'Алдаа гарлаа.';
          for (const f of images) updateStatus(f.name, 'error', msg);
        }
        void label;
      }
      for (const file of docs) {
        try {
          const res = await adminImportFile(file);
          const msg = res.message ?? (res.test ? `Тест үүслээ: ${res.test.title}` : 'Файл амжилттай оруулагдлаа.');
          updateStatus(file.name, 'done', msg);
        } catch (err) {
          updateStatus(file.name, 'error', err instanceof ApiError ? err.message : 'Алдаа гарлаа.');
        }
      }
      await refreshTests();
    } finally {
      setImportBusy(false);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePasteImport() {
    if (!pasteText.trim()) {
      setError('Эхлээд текст оруулна уу.');
      return;
    }
    setPasteBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await adminImportText(pasteText);
      setMessage(res.message ?? (res.test ? `Тест үүслээ: ${res.test.title}` : 'Текстээс тест үүслээ.'));
      setPasteText('');
      await refreshTests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Текст оруулахад алдаа гарлаа.');
    } finally {
      setPasteBusy(false);
    }
  }

  async function saveQpay() {
    setQpayBusy(true);
    setError('');
    setMessage('');
    try {
      const patch: { clientId: string; invoiceCode: string; merchantId: string; clientSecret?: string } = {
        clientId: qpayClientId.trim(),
        invoiceCode: qpayInvoiceCode.trim(),
        merchantId: qpayMerchantId.trim(),
      };
      if (qpaySecret.trim()) {
        patch.clientSecret = qpaySecret;
      }
      const saved = await adminSaveQpay(patch);
      setQpay(saved);
      setQpaySecret('');
      setMessage('QPay тохиргоо хадгалагдлаа.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Хадгалахад алдаа гарлаа.');
    } finally {
      setQpayBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <p className="loading">Ачааллаж байна...</p>
      </div>
    );
  }

  return (
    <div className="container admin-layout">
      <div className="page-head">
        <h1>Админ хэсэг</h1>
        <p>Тест, хэрэглэгч, QPay тохиргоог эндээс удирдана.</p>
      </div>

      <div className="tabs">
        <button type="button" className={`tab${tab === 'tests' ? ' active' : ''}`} onClick={() => setTab('tests')}>
          Тестүүд
        </button>
        <button type="button" className={`tab${tab === 'import' ? ' active' : ''}`} onClick={() => setTab('import')}>
          Файл оруулах
        </button>
        <button type="button" className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
          Хэрэглэгчид
        </button>
        <button type="button" className={`tab${tab === 'qpay' ? ' active' : ''}`} onClick={() => setTab('qpay')}>
          QPay тохиргоо
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {tab === 'tests' && (
        <div className="admin-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Гарчиг</th>
                  <th>Ангилал</th>
                  <th>Асуулт</th>
                  <th>Үнэ</th>
                  <th>Төлөв</th>
                  <th>Үйлдэл</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id}>
                    <td>{t.title}</td>
                    <td>{t.category}</td>
                    <td>{t.questionCount}</td>
                    <td>{t.priceMnt.toLocaleString('mn-MN')}₮</td>
                    <td>{t.published ? 'Нийтлэгдсэн' : 'Нуугдсан'}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn-outline btn-small" onClick={() => togglePublished(t)}>
                          {t.published ? 'Нуух' : 'Нийтлэх'}
                        </button>
                        <button type="button" className="btn btn-outline btn-small" onClick={() => startEdit(t)}>
                          Засах
                        </button>
                        <button type="button" className="btn btn-danger btn-small" onClick={() => deleteTest(t)}>
                          Устгах
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tests.length === 0 && <p className="empty">Тест алга байна.</p>}

          {editing && (
            <div className="edit-form">
              <h3>Тест засах: {editing.title}</h3>
              <div className="field">
                <label className="label" htmlFor="edit-title">
                  Гарчиг
                </label>
                <input id="edit-title" className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="edit-desc">
                  Тайлбар
                </label>
                <textarea
                  id="edit-desc"
                  className="textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="edit-category">
                  Ангилал
                </label>
                <input
                  id="edit-category"
                  className="input"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="edit-price">
                  Үнэ (₮)
                </label>
                <input
                  id="edit-price"
                  className="input"
                  type="number"
                  min={0}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
              <div className="actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-small" onClick={saveEdit} disabled={editBusy}>
                  Хадгалах
                </button>
                <button type="button" className="btn btn-outline btn-small" onClick={() => setEditing(null)}>
                  Болих
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="admin-panel">
          <div className="field">
            <label className="label" htmlFor="import-file">
              Файл сонгох (.docx, .pdf, .xlsx, .pptx, .txt, зураг гэх мэт)
            </label>
            <input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={onFilesChange}
            />
            {files.length > 0 && <p className="note">Сонгогдсон: {files.map((f) => f.name).join(', ')}</p>}
          </div>
          <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={importBusy || files.length === 0}>
            {importBusy ? 'Оруулж байна...' : 'Оруулах'}
          </button>
          {fileStatuses.length > 0 && (
            <ul className="file-status">
              {fileStatuses.map((s) => (
                <li key={s.name} className={s.state === 'error' ? 'error' : s.state === 'done' ? 'done' : ''}>
                  <strong>{s.name}</strong> — {s.message}
                </li>
              ))}
            </ul>
          )}
          <p className="note">Оруулсан файл автоматаар тест болон хувирна.</p>
          <p>
            <button type="button" className="link-btn" onClick={downloadTemplate}>
              Загвар татах
            </button>
          </p>

          <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--line)' }} />

          <div className="field">
            <label className="label" htmlFor="paste-text">
              Текстээс оруулах
            </label>
            <textarea
              id="paste-text"
              className="textarea"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Тестийн текстээ энд буулгана уу..."
            />
          </div>
          <button type="button" className="btn btn-outline" onClick={handlePasteImport} disabled={pasteBusy}>
            {pasteBusy ? 'Оруулж байна...' : 'Текстээс оруулах'}
          </button>
        </div>
      )}

      {tab === 'users' && (
        <div className="admin-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Нэр</th>
                  <th>Хэрэглэгчийн нэр</th>
                  <th>Эрх</th>
                  <th>Бүртгүүлсэн</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.username}</td>
                    <td>{u.role === 'admin' ? 'Админ' : 'Гишүүн'}</td>
                    <td>{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && <p className="empty">Хэрэглэгч алга байна.</p>}
        </div>
      )}

      {tab === 'qpay' && (
        <div className="admin-panel">
          <p className="qpay-state">
            Тохируулагдсан: {qpay?.configured ? 'Тийм' : 'Үгүй'}
            {qpay ? ` (эх сурвалж: ${qpay.source === 'env' ? 'env' : qpay.source === 'db' ? 'DB' : 'байхгүй'})` : ''}
          </p>
          <div className="field">
            <label className="label" htmlFor="qpay-client-id">
              Client ID
            </label>
            <input
              id="qpay-client-id"
              className="input"
              value={qpayClientId}
              onChange={(e) => setQpayClientId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="qpay-secret">
              Client Secret {qpay?.hasSecret ? '(хадгалагдсан — солих бол шинээр оруулна уу)' : ''}
            </label>
            <input
              id="qpay-secret"
              className="input"
              type="password"
              value={qpaySecret}
              onChange={(e) => setQpaySecret(e.target.value)}
              autoComplete="new-password"
              placeholder="Хоосон орхивол өмнөх нь хэвээр үлдэнэ"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="qpay-invoice">
              Invoice Code
            </label>
            <input
              id="qpay-invoice"
              className="input"
              value={qpayInvoiceCode}
              onChange={(e) => setQpayInvoiceCode(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="qpay-merchant">
              Merchant ID
            </label>
            <input
              id="qpay-merchant"
              className="input"
              value={qpayMerchantId}
              onChange={(e) => setQpayMerchantId(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={saveQpay} disabled={qpayBusy}>
            {qpayBusy ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          <p className="note">
            QPay merchant мэдээллээ оруулсны дараа жинхэнэ QR үүснэ. Хоосон орхивол туршилтын горим ажиллана.
          </p>
        </div>
      )}
    </div>
  );
}
