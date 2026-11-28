import type { TestSummary, User } from '../../../shared/src/types';
import Mascot from '../components/Mascot';

interface HomeProps {
  tests: TestSummary[];
  user: User | null;
  onStart: (test: TestSummary) => void;
  onAuth: () => void;
  onResults: () => void;
  onAdmin: () => void;
}

export default function Home({ tests, user, onStart, onAuth, onResults, onAdmin }: HomeProps) {
  const visible = tests.filter((t) => t.published);
  const isAdmin = user?.role === 'admin';

  // Тойрог цэс: голд нь од, тойронд нь цэсний зүйлс. Дархаар тухайн хэсэг рүүгээ очдог.
  const menuItems: { label: string; icon: string; onClick: () => void }[] = [
    { label: 'Нүүр', icon: '⌂', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    {
      label: 'Тестүүд',
      icon: '✎',
      onClick: () => document.getElementById('tests')?.scrollIntoView({ behavior: 'smooth' }),
    },
    ...(user
      ? [{ label: 'Миний үр дүн', icon: '♥', onClick: onResults }]
      : [{ label: 'Нэвтрэх', icon: '➜', onClick: onAuth }]),
    ...(isAdmin ? [{ label: 'Админ', icon: '⚙', onClick: onAdmin }] : []),
  ];

  // Цэсийн зүйлсийг тойрог дээр жигд байрлуулна: 0° = дээд талд, цагийн зүүний дагуу.
  const menuPos = (i: number, n: number) => {
    const rad = ((i * 360) / n) * (Math.PI / 180);
    return {
      left: `${(50 + 38 * Math.sin(rad)).toFixed(1)}%`,
      top: `${(50 - 38 * Math.cos(rad)).toFixed(1)}%`,
    };
  };

  return (
    <div>
      <section className="hero">
        <span className="sparkle s1" aria-hidden="true">✦</span>
        <span className="sparkle s2" aria-hidden="true">✦</span>
        <span className="sparkle s3" aria-hidden="true">✦</span>
        <span className="sparkle s4" aria-hidden="true">✦</span>
        <span className="sparkle s5" aria-hidden="true">✦</span>
        <span className="sparkle s6" aria-hidden="true">✦</span>
        <div className="container hero-inner">
          <div className="hero-art">
            <div className="orbital" role="navigation" aria-label="Цэс">
              <div className="orbital-orbit">
                <div className="orbital-ring" aria-hidden="true" />
                {menuItems.map((item, i) => (
                  <button
                    key={item.label}
                    type="button"
                    className="orbital-node"
                    style={menuPos(i, menuItems.length)}
                    onClick={item.onClick}
                    aria-label={item.label}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span className="orbital-node-label">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="orbital-hub" aria-hidden="true">
                <Mascot className="orbital-mascot" />
              </div>
            </div>
          </div>
          <div className="hero-text">
            <p className="hero-eyebrow">Монгол хэл дээрх сэтгэл зүйн тестийн сан</p>
            <h1 className="hero-title">Сэтгэлийн Одод</h1>
            <p className="hero-subtitle">
              Өөрийгөө таньж, сэтгэлээ сонсоорой. Тестээ өгч, үр дүнгээ шууд хараарай — монгол
              хэлээр, энгийнээр.
            </p>
            <div className="hero-points">
              <span className="hero-point">Нэг тест 6,500₮</span>
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
            <p className="hero-stats">Нийт {visible.length} тест</p>
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
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>Бүртгүүлэх</h3>
            <p>Нэр, хэрэглэгчийн нэр, нууц үгээрээ бүртгүүлж нэвтэрнэ үү.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>Төлбөр төлөх</h3>
            <p>
              Нэг тест <span className="price-tag">6,500₮</span> — QPay QR кодоор төлнө.
            </p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>Тест өгч үр дүнгээ шууд харах</h3>
            <p>Асуултуудад хариулж, үр дүнгээ шууд харж, хадгална.</p>
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
