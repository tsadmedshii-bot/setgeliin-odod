// Алтан амьдралын мод — оригинал inline SVG дүрслэл.
export default function TreeOfLife({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label="Алтан амьдралын мод" fill="none">
      <defs>
        <radialGradient id="tree-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffd76a" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#f6c453" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f6c453" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="trunk-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#b8860b" />
          <stop offset="50%" stopColor="#f6c453" />
          <stop offset="100%" stopColor="#d4a017" />
        </linearGradient>
        <filter id="soft-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      {/* Зөөлөн алтан гэрэлтүүлэг */}
      <circle cx="200" cy="180" r="150" fill="url(#tree-glow)" filter="url(#soft-blur)" />

      {/* Их бие — муруй, дээшээ нарийссан */}
      <path
        d="M196 372 C 188 320, 206 290, 192 250 C 184 224, 196 206, 200 186 L 210 186 C 206 210, 216 228, 210 252 C 220 292, 214 326, 214 372 Z"
        fill="url(#trunk-gold)"
      />
      {/* Үндэс */}
      <path d="M196 372 C 180 384, 158 388, 140 384 C 162 378, 180 374, 192 368 Z" fill="#d4a017" />
      <path d="M214 372 C 230 384, 252 388, 270 384 C 248 378, 230 374, 218 368 Z" fill="#d4a017" />

      {/* Мөчрүүд */}
      <g stroke="#e9b949" strokeWidth="7" strokeLinecap="round">
        <path d="M200 240 C 170 210, 140 200, 108 186" />
        <path d="M202 210 C 226 184, 258 176, 292 164" />
        <path d="M200 186 C 186 158, 176 140, 158 118" />
        <path d="M204 186 C 220 156, 232 138, 248 112" />
        <path d="M200 252 C 160 250, 128 258, 96 250" />
        <path d="M202 252 C 244 250, 276 258, 306 248" />
        <path d="M200 200 C 200 168, 200 140, 200 104" />
      </g>
      <g stroke="#f6c453" strokeWidth="3.5" strokeLinecap="round">
        <path d="M108 186 C 96 168, 88 156, 76 142" />
        <path d="M292 164 C 304 146, 312 134, 324 120" />
        <path d="M158 118 C 148 100, 142 88, 136 72" />
        <path d="M248 112 C 258 94, 264 82, 270 66" />
        <path d="M200 104 C 200 86, 200 72, 200 56" />
      </g>

      {/* Навч / жимс — дугуй, гэрэлтсэн */}
      <g>
        <circle cx="76" cy="142" r="13" fill="#ffd76a" />
        <circle cx="96" cy="120" r="10" fill="#f6c453" />
        <circle cx="60" cy="168" r="9" fill="#ff7eb6" />
        <circle cx="136" cy="72" r="12" fill="#ffd76a" />
        <circle cx="118" cy="96" r="9" fill="#f6c453" />
        <circle cx="168" cy="66" r="9" fill="#ff7eb6" />
        <circle cx="200" cy="56" r="14" fill="#ffd76a" />
        <circle cx="200" cy="34" r="9" fill="#ff7eb6" />
        <circle cx="224" cy="80" r="9" fill="#f6c453" />
        <circle cx="270" cy="66" r="12" fill="#ffd76a" />
        <circle cx="292" cy="92" r="9" fill="#ff7eb6" />
        <circle cx="324" cy="120" r="13" fill="#ffd76a" />
        <circle cx="340" cy="146" r="9" fill="#f6c453" />
        <circle cx="306" cy="248" r="11" fill="#ffd76a" />
        <circle cx="330" cy="226" r="8" fill="#ff7eb6" />
        <circle cx="96" cy="250" r="11" fill="#ffd76a" />
        <circle cx="72" cy="228" r="8" fill="#ff7eb6" />
        <circle cx="148" cy="196" r="9" fill="#ffd76a" />
        <circle cx="252" cy="190" r="9" fill="#ffd76a" />
        <circle cx="186" cy="140" r="8" fill="#ff7eb6" />
        <circle cx="216" cy="136" r="8" fill="#f6c453" />
      </g>

      {/* Гялалзсан одод */}
      <g fill="#fff8ec">
        <circle cx="120" cy="60" r="2.5" />
        <circle cx="286" cy="52" r="2.5" />
        <circle cx="348" cy="196" r="2.5" />
        <circle cx="52" cy="206" r="2.5" />
        <circle cx="238" cy="40" r="2" />
        <circle cx="162" cy="44" r="2" />
      </g>
    </svg>
  );
}
