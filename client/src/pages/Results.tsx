import { useEffect, useState } from 'react';
import type { AttemptResult } from '../../../shared/src/types';
import { ApiError, myResults } from '../api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('mn-MN');
}

export default function Results() {
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    myResults()
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Үр дүн ачааллахад алдаа гарлаа.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container">
      <div className="page-head">
        <h1>Миний үр дүн</h1>
      </div>
      {loading ? (
        <p className="loading">Ачааллаж байна...</p>
      ) : error ? (
        <div className="error">{error}</div>
      ) : results.length === 0 ? (
        <p className="empty">Та одоогоор тест өгөөгүй байна.</p>
      ) : (
        <div className="results-list">
          {results.map((r) => (
            <article className="result-item" key={r.id}>
              <h3>{r.testTitle}</h3>
              <p className="result-title">{r.resultTitle}</p>
              <p className="meta">
                Оноо: {r.score} / {r.maxScore} · {formatDate(r.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
