import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TestSummary, User } from '../../../shared/src/types';
import TreeOfLife from '../components/TreeOfLife';
import Mascot from '../components/Mascot';

interface HomeProps {
  tests: TestSummary[];
  user: User | null;
  onStart: (test: TestSummary) => void;
  onAuth: () => void;
}

// Тойрог алхмууд: голд нь од, тойронд нь 4 алхам (цагийн зүүний дагуу).
const STEPS: { title: string; desc: ReactNode; left: string; top: string }[] = [
  {
    title: 'Бүртгүүлэх',
    desc: 'Нэр, хэрэглэгчийн нэр, нууц үгээрээ бүртгүүлж нэвтэрнэ үү.',
    left: '50%',
    top: '12%',
  },
  {
    title: 'Төлбөр төлөх',
    desc: (
      <>
        Нэг тест <span className="price-tag">6,500₮</span> — QPay QR кодоор төлнө.
      </>
    ),
    left: '88%',
    top: '50%',
  },
  {
    title: 'Тест өгөх',
    desc: 'Асуултуудад хариулна. Хариулт бүрийн дараа дараагийн асуулт гарч ирнэ.',
    left: '50%',
    top: '88%',
  },
  {
    title: 'Үр дүн харах',
    desc: 'Үр дүнгээ шууд харж, «Миний үр дүн» хэсэгт хадгална.',
    left: '12%',
    top: '50%',
  },
];

export default function Home({ tests, user, onStart, onAuth }: HomeProps) {
  const visible = tests.filter((t) => t.published);
  const [active, setActive] = useState(0);
  const prev = () => setActive((active + STEPS.length - 1) % STEPS.length);
  const next = () => setActive((active + 1) % STEPS.length);

  return (
    <div>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-art">
            <TreeOfLife className="hero-tree" />
            <Mascot className="hero-mascot" />
          </div>
          <div className="hero-text">
            <p className="hero-eyebrow">Монгол хэл дээрх сэтгэл зүйн тестийн сан</p>
            <h1 className="hero-title">Сэтгэлийн Одод</h1>
            <p className="hero-subtitle">
              Өөрийгөө таньж, сэтгэлээ сонсоорой. Тестээ өгч, үр дүнгээ шууд хараарай — монгол
              хэлээр, энгийнээр.
            </p>
            <div className="hero-points">
              <span className="hero-point">Үр дүн шууд</span>
              <span className="hero-point">Нэг тест 6,500₮</span>
              <span className="hero-point">Монгол хэлээр</span>
            </div>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#tests">
                Тестүүд үзэх
              </a>
              {!user && (
                <button type="button" className="btn btn-ghost" onClick={onAuth}>
                  Нэвтрэх / Бүртгүүлэх
                </button>
              )}
            </div>
            <p className="hero-stats">Нийт {visible.length} тест · Нэг тест 6,500₮</p>
          </div>
        </div>
      </section>

      <section className="section container" id="why">
        <h2 className="section-title">Яагаад Сэтгэлийн Одод вэ?</h2>
        <p className="section-sub">Тест өгөхөөс үр дүнгээ харах хүртэл — бүх юм энгийн.</p>
        <div className="benefits">
          <article className="benefit-card">
            <span className="benefit-icon" aria-hidden="true">
              ★
            </span>
            <h3>Үр дүн шууд</h3>
            <p>Тестээ дуусгамагц үр дүнгээ шууд харна. Үр дүн чинь «Миний үр дүн» хэсэгт хадгалагдана.</p>
          </article>
          <article className="benefit-card">
            <span className="benefit-icon" aria-hidden="true">
              ★
            </span>
            <h3>Эхлэхээсээ өмнө зорилгоо мэднэ</h3>
            <p>
              Тест бүрийн өмнө «Тестийн зорилго» дэлгэц гарч, юуг хэмжих, яаж хариулахыг тайлбарлана.
            </p>
          </article>
          <article className="benefit-card">
            <span className="benefit-icon" aria-hidden="true">
              ★
            </span>
            <h3>Монгол хэлээр, энгийнээр</h3>
            <p>Асуулт, тайлбар, үр дүн — бүгд монгол хэлээр. Утсан дээр ч эвтэйхэн харагдана.</p>
          </article>
          <article className="benefit-card">
            <span className="benefit-icon" aria-hidden="true">
              ★
            </span>
            <h3>Таны үр дүн — зөвхөн таных</h3>
            <p>Нэвтэрч орсон хэрэглэгч өөрийн үр дүнгээ л харна.</p>
          </article>
        </div>
        <p className="benefit-note">
          Тестүүд нь өөрийгөө таних, сэтгэлээ сонсох зориулалттай бөгөөд эмнэлгийн онош, эмчилгээний
          шийдвэр биш юм.
        </p>
      </section>

      <section className="section container" id="how">
        <h2 className="section-title">Хэрхэн ажилладаг вэ?</h2>
        <p className="section-sub">Алхам дээр нь дарж, дэлгэрэнгүйг нь хараарай.</p>
        <div className="orbital-wrap">
          <div className="orbital" role="group" aria-label="Хэрхэн ажилладаг вэ">
            <div className="orbital-ring" aria-hidden="true" />
            <div className="orbital-hub" aria-hidden="true">
              <Mascot className="orbital-mascot" />
            </div>
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`orbital-node${i === active ? ' active' : ''}`}
                style={{ left: s.left, top: s.top }}
                onClick={() => setActive(i)}
                aria-label={`Алхам ${i + 1}: ${s.title}`}
                aria-pressed={i === active}
              >
                {i + 1}
                <span className="orbital-node-label">{s.title}</span>
              </button>
            ))}
          </div>
          <div className="orbital-card">
            <h3>
              {active + 1}. {STEPS[active].title}
            </h3>
            <p>{STEPS[active].desc}</p>
            <div className="orbital-nav">
              <button
                type="button"
                className="orbital-arrow"
                onClick={prev}
                aria-label="Өмнөх алхам"
              >
                ‹
              </button>
              <button
                type="button"
                className="orbital-arrow"
                onClick={next}
                aria-label="Дараах алхам"
              >
                ›
              </button>
            </div>
            <div className="orbital-dots">
              {STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  className={`orbital-dot${i === active ? ' active' : ''}`}
                  onClick={() => setActive(i)}
                  aria-label={`Алхам ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section container" id="tests">
        <h2 className="section-title">Тестүүд</h2>
        <p className="section-sub">Өөрт тохирох тестээ сонгоорой.</p>
        {visible.length === 0 ? (
          <p className="empty">
            Одоогоор нийтлэгдсэн тест алга байна. Удахгүй шинэ тестүүд нэмэгдэнэ — түр хүлээгээрэй.
          </p>
        ) : (
          <div className="test-grid">
            {visible.map((test) => (
              <article className="test-card" key={test.id}>
                <span className="badge">{test.category}</span>
                <h3 className="card-title">{test.title}</h3>
                <p className="card-desc">{test.description || 'Тайлбар оруулаагүй байна.'}</p>
                <div className="card-meta">
                  <span>{test.questionCount} асуулт</span>
                  <span className="card-price">6,500₮</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => (user ? onStart(test) : onAuth())}
                >
                  Тест өгөх
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section container" id="faq">
        <h2 className="section-title">Түгээмэл асуулт</h2>
        <div className="faq-list">
          <details className="faq-item">
            <summary>Нэг тест хэдэн төгрөг вэ?</summary>
            <p>6,500₮. QPay QR кодоор төлнө.</p>
          </details>
          <details className="faq-item">
            <summary>Үр дүнгээ хэзээ харах вэ?</summary>
            <p>
              Тестээ дуусгамагц шууд. Үр дүн «Миний үр дүн» хэсэгт хадгалагдаж, дараа нь эргэж харж
              болно.
            </p>
          </details>
          <details className="faq-item">
            <summary>Бүртгүүлэх шаардлагатай юу?</summary>
            <p>Тийм. Нэр, хэрэглэгчийн нэр, нууц үгээрээ бүртгүүлж нэвтэрнэ.</p>
          </details>
          <details className="faq-item">
            <summary>Тестүүд юунд зориулагдсан бэ?</summary>
            <p>
              Өөрийгөө таних, сэтгэлийн байдлаа сонсох зориулалттай. Эмнэлгийн онош биш бөгөөд
              сэтгэл түгшээж байвал мэргэжлийн хүнд хандаарай.
            </p>
          </details>
        </div>
      </section>

      <section className="section container">
        <div className="cta-banner">
          <h2>Өнөөдөр сэтгэлээ сонсоорой</h2>
          <p>Тестээ сонгоод, хэдхэн минутын дараа үр дүнгээ хараарай.</p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#tests">
              Тестүүд үзэх
            </a>
            {!user && (
              <button type="button" className="btn btn-ghost" onClick={onAuth}>
                Бүртгүүлэх
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
