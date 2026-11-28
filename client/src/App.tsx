import { useCallback, useEffect, useState } from 'react';
import type { TestSummary, User } from '../../shared/src/types';
import { listTests, logout, me } from './api';
import Home from './pages/Home';
import Auth from './pages/Auth';
import TestFlow from './pages/TestFlow';
import Results from './pages/Results';
import Admin from './pages/Admin';

type View = 'home' | 'auth' | 'test' | 'results' | 'admin';

function StarLogo() {
  return (
    <svg viewBox="0 0 100 100" className="logo-star" aria-hidden="true">
      <path
        d="M50 6 L61 38 L95 39 L68 59 L78 93 L50 73 L22 93 L32 59 L5 39 L39 38 Z"
        fill="#f6c453"
        stroke="#ffd76a"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);

  const refreshTests = useCallback(async () => {
    try {
      setTests(await listTests());
    } catch {
      // Тестийн жагсаалт ачааллахад алдаа гарвал хоосон жагсаалтаар үлдээнэ.
    }
  }, []);

  useEffect(() => {
    me()
      .then((u) => setUser(u))
      .catch(() => {
        // Нэвтрээгүй — алдааг үл тооно.
      });
    void refreshTests();
  }, [refreshTests]);

  function goHome() {
    setView('home');
    setSelectedTestId(null);
    void refreshTests();
  }

  function handleAuthDone(u: User) {
    setUser(u);
    setView('home');
    void refreshTests();
  }

  function handleLogout() {
    logout();
    setUser(null);
    setSelectedTestId(null);
    setView('home');
  }

  function startTest(test: TestSummary) {
    setSelectedTestId(test.id);
    setView('test');
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <header className="site-header">
        <div className="container header-inner">
          <button type="button" className="brand" onClick={goHome}>
            <StarLogo />
            <span className="brand-name">Сэтгэлийн Одод</span>
          </button>
          <nav className="nav">
            <button type="button" className={`nav-link${view === 'home' ? ' active' : ''}`} onClick={goHome}>
              Нүүр
            </button>
            <button
              type="button"
              className={`nav-link${view === 'home' ? ' active' : ''}`}
              onClick={() => {
                setView('home');
                document.getElementById('tests')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Тестүүд
            </button>
            {user && (
              <button
                type="button"
                className={`nav-link${view === 'results' ? ' active' : ''}`}
                onClick={() => setView('results')}
              >
                Миний үр дүн
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className={`nav-link${view === 'admin' ? ' active' : ''}`}
                onClick={() => setView('admin')}
              >
                Админ
              </button>
            )}
            <span className="auth-area">
              {user ? (
                <>
                  <span className="user-name">{user.name}</span>
                  <button type="button" className="btn btn-ghost btn-small" onClick={handleLogout}>
                    Гарах
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setView('auth')}>
                  Нэвтрэх / Бүртгүүлэх
                </button>
              )}
            </span>
          </nav>
        </div>
      </header>

      <main>
        {view === 'home' && (
          <Home
            tests={tests}
            user={user}
            onStart={startTest}
            onAuth={() => setView('auth')}
            onResults={() => setView('results')}
            onAdmin={() => setView('admin')}
          />
        )}
        {view === 'auth' && <Auth onDone={handleAuthDone} />}
        {view === 'test' && selectedTestId !== null && (
          <TestFlow testId={selectedTestId} onDone={() => setView('results')} onBack={goHome} />
        )}
        {view === 'results' && (user ? <Results /> : <Auth onDone={handleAuthDone} />)}
        {view === 'admin' &&
          (isAdmin ? <Admin /> : <p className="container empty">Энэ хэсэг зөвхөн админд нээлттэй.</p>)}
      </main>

      <footer className="site-footer">
        <p className="footer-title">Сэтгэл зүй</p>
        <p>Өөрийгөө таньж мэдэх туршлага</p>
        <p>© 2026 Сэтгэл зүйн тестийн сан · Тестүүд нь оношилгоо биш</p>
      </footer>
    </div>
  );
}
