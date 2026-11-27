import { useEffect, useRef, useState } from 'react';
import type { Purchase, TestDetail } from '../../../shared/src/types';
import {
  ApiError,
  checkPayment,
  confirmPayment,
  createPayment,
  getTest,
  submitAnswers,
  type SubmitResult,
} from '../api';
import Mascot from '../components/Mascot';

type Stage = 'pay' | 'purpose' | 'questions' | 'result';

interface TestFlowProps {
  testId: number;
  onDone: () => void;
  onBack: () => void;
}

export default function TestFlow({ testId, onDone, onBack }: TestFlowProps) {
  const [stage, setStage] = useState<Stage>('pay');
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [test, setTest] = useState<TestDetail | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Төлбөр үүсгэх; аль хэдийн төлсөн бол зорилгын дэлгэц рүү шууд очно.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    createPayment(testId)
      .then((p) => {
        if (cancelled) return;
        setPurchase(p);
        if (p.status === 'paid') {
          setStage('purpose');
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Төлбөрийн мэдээлэл авахад алдаа гарлаа.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  // Тестийн асуултуудыг зорилгын дэлгэц гарч ирэх үед татна.
  useEffect(() => {
    if (stage !== 'purpose' && stage !== 'questions') return;
    if (test) return;
    let cancelled = false;
    getTest(testId)
      .then((t) => {
        if (cancelled) return;
        setTest(t);
        setAnswers(new Array(t.questions.length).fill(-1));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 402) {
          setStage('pay');
          setError('Энэ тестийг өгөхийн тулд эхлээд төлбөр төлнө үү.');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Тест ачааллахад алдаа гарлаа.');
      });
    return () => {
      cancelled = true;
    };
  }, [stage, testId, test]);

  function clearPendingAdvance() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      const p = await confirmPayment(testId);
      setPurchase(p);
      setStage('purpose');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Баталгаажуулахад алдаа гарлаа.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckPayment() {
    setBusy(true);
    setError('');
    try {
      const check = await checkPayment(testId);
      if (check.paid) {
        if (check.purchase) setPurchase(check.purchase);
        setStage('purpose');
      } else {
        setError('Төлбөр хараахан баталгаажаагүй байна. Төлсний дараа дахин шалгана уу.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Төлбөр шалгахад алдаа гарлаа.');
    } finally {
      setBusy(false);
    }
  }

  function chooseOption(optionIndex: number) {
    if (!test) return;
    setSelected(optionIndex);
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
    clearPendingAdvance();
    if (index < test.questions.length - 1) {
      timerRef.current = window.setTimeout(() => {
        setIndex((i) => i + 1);
        setSelected(null);
        timerRef.current = null;
      }, 450);
    }
  }

  function goToQuestion(i: number) {
    if (!test) return;
    clearPendingAdvance();
    setSelected(null);
    setIndex(Math.max(0, Math.min(i, test.questions.length - 1)));
  }

  async function handleSubmit() {
    if (!test) return;
    const firstUnanswered = answers.findIndex((a) => a < 0);
    if (firstUnanswered >= 0) {
      setError(`Бүх асуултад хариулна уу. ${firstUnanswered + 1} дугаар асуулт хариулагдаагүй байна.`);
      goToQuestion(firstUnanswered);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await submitAnswers(testId, answers);
      setResult(r);
      setStage('result');
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setStage('pay');
        setError('Энэ тестийг өгөхийн тулд эхлээд төлбөр төлнө үү.');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Үр дүн илгээхэд алдаа гарлаа.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && stage === 'pay' && !purchase) {
    return (
      <div className="container">
        <p className="loading">Төлбөрийн мэдээлэл ачааллаж байна...</p>
      </div>
    );
  }

  if (stage === 'pay') {
    const qpayConfigured = purchase?.qpayConfigured ?? false;
    return (
      <div className="container">
        <div className="page-head">
          <h1>Төлбөр төлөх</h1>
          <p>{purchase?.testTitle ?? 'Тест'}</p>
        </div>
        <div className="pay-box">
          <p className="pay-price">6,500₮</p>
          {error && <div className="error">{error}</div>}
          {qpayConfigured ? (
            <>
              {purchase?.qrImage && <img className="qr-img" src={purchase.qrImage} alt="QPay QR код" />}
              {purchase?.qrText && <p className="qr-text">{purchase.qrText}</p>}
              <p>QPay аппаар уншуулж төлнө үү.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={handleCheckPayment} disabled={busy}>
                Төлбөр шалгах
              </button>
            </>
          ) : (
            <>
              <div className="notice notice-warn">
                QPay холбогдоогүй байна — энэ бол туршилтын баталгаажуулалт. Жинхэнэ төлбөр авагдахгүй.
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={handleConfirm} disabled={busy}>
                {busy ? 'Түр хүлээнэ үү...' : 'Би төлсөн (туршилтын баталгаажуулалт)'}
              </button>
            </>
          )}
          <p className="note">
            <button type="button" className="link-btn" onClick={onBack}>
              Буцах
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (stage === 'purpose') {
    return (
      <div className="container">
        <div className="purpose">
          <h2>Тестийн зорилго</h2>
          {error && <div className="error">{error}</div>}
          <h3>{test?.title ?? purchase?.testTitle ?? 'Тест'}</h3>
          <p className="purpose-desc">{test?.description || 'Энэ тестийн талаар тайлбар оруулаагүй байна.'}</p>
          <p>
            <strong>{test ? `${test.questions.length} асуулт` : 'Асуултын тоо ачааллаж байна...'}</strong>
          </p>
          <ul className="guide-list">
            <li>Асуулт бүрийг анхааралтай уншаад, өөртөө хамгийн үнэн тохирох хариултыг сонгоорой.</li>
            <li>Хариултаа сонгоход дараагийн асуулт автоматаар гарч ирнэ.</li>
            <li>Хариултаа өөрчлөхийг хүсвэл «Өмнөх» товчоор буцаж болно.</li>
          </ul>
          <button type="button" className="btn btn-primary btn-block" onClick={() => setStage('questions')}>
            Тест эхлэх
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'questions' && test) {
    const question = test.questions[index];
    const answeredCount = answers.filter((a) => a >= 0).length;
    const isLast = index === test.questions.length - 1;
    return (
      <div className="container">
        <div className="page-head">
          <h1>{test.title}</h1>
        </div>
        <p className="progress">
          Асуулт {index + 1} / {test.questions.length} · {answeredCount} хариулсан
        </p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((index + 1) / test.questions.length) * 100}%` }}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="question-box">
          <p className="question-text">{question.text}</p>
          {question.image && <img className="question-img" src={question.image} alt="Асуултын зураг" />}
          <div className="options">
            {question.options.map((option, oi) => (
              <button
                key={oi}
                type="button"
                className={`option${selected === oi || answers[index] === oi ? ' selected' : ''}`}
                onClick={() => chooseOption(oi)}
              >
                {option.image && <img className="option-img" src={option.image} alt="" />}
                <span>{option.text}</span>
              </button>
            ))}
          </div>
          <div className="question-nav">
            <button type="button" className="btn btn-outline btn-small" onClick={() => goToQuestion(index - 1)} disabled={index === 0}>
              Өмнөх
            </button>
            {isLast ? (
              <button type="button" className="btn btn-primary btn-small" onClick={handleSubmit} disabled={busy}>
                {busy ? 'Илгээж байна...' : 'Үр дүн харах'}
              </button>
            ) : (
              <button type="button" className="btn btn-outline btn-small" onClick={() => goToQuestion(index + 1)}>
                Дараах
              </button>
            )}
          </div>
          <p className="auto-hint">Хариултаа сонгоход дараагийн асуулт автоматаар гарч ирнэ.</p>
        </div>
      </div>
    );
  }

  if (stage === 'result' && result) {
    return (
      <div className="container">
        <div className="result-panel">
          <Mascot className="result-mascot" />
          <h2>{result.resultTitle}</h2>
          <p className="score">
            Оноо: {result.score} / {result.maxScore}
          </p>
          <p>{result.resultDescription}</p>
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Миний үр дүн рүү
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <p className="loading">Ачааллаж байна...</p>
    </div>
  );
}
