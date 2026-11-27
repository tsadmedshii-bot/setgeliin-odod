// Хөөрхөн алтан од — ягаан зүрх тэвэрсэн kawaii дүрслэл (оригинал inline SVG).
export default function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Зүрх тэвэрсэн алтан од" fill="none">
      <defs>
        <radialGradient id="star-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffe9a8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffe9a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="star-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="55%" stopColor="#f6c453" />
          <stop offset="100%" stopColor="#e0a52e" />
        </linearGradient>
        <linearGradient id="heart-pink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9ec4" />
          <stop offset="100%" stopColor="#ff5e9c" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="98" r="88" fill="url(#star-glow)" />

      {/* Таван хошуут од */}
      <path
        d="M100 22 L118 74 L173 76 L129 108 L145 162 L100 130 L55 162 L71 108 L27 76 L82 74 Z"
        fill="url(#star-gold)"
        stroke="#c98f1b"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Нүд — жаргалтай хаалттай нүд */}
      <path d="M76 92 Q83 84 90 92" stroke="#5b3a00" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M110 92 Q117 84 124 92" stroke="#5b3a00" strokeWidth="3.5" strokeLinecap="round" />

      {/* Инээмсэглэл */}
      <path d="M90 106 Q100 114 110 106" stroke="#5b3a00" strokeWidth="3.5" strokeLinecap="round" />

      {/* Хацар */}
      <circle cx="70" cy="104" r="6" fill="#ff9ec4" opacity="0.75" />
      <circle cx="130" cy="104" r="6" fill="#ff9ec4" opacity="0.75" />

      {/* Тэвэрсэн ягаан зүрх */}
      <path
        d="M100 168 C 84 156, 68 144, 68 130 C 68 120, 76 114, 84 114 C 92 114, 97 119, 100 124 C 103 119, 108 114, 116 114 C 124 114, 132 120, 132 130 C 132 144, 116 156, 100 168 Z"
        fill="url(#heart-pink)"
        stroke="#d63d7e"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M78 128 Q82 122 88 122" stroke="#ffd3e3" strokeWidth="3" strokeLinecap="round" />

      {/* Гар — зүрхийг тэвэрч байгаа мэт */}
      <path d="M62 138 Q74 148 86 150" stroke="#c98f1b" strokeWidth="4" strokeLinecap="round" />
      <path d="M138 138 Q126 148 114 150" stroke="#c98f1b" strokeWidth="4" strokeLinecap="round" />

      {/* Гялалзсан одод */}
      <g fill="#ffffff">
        <path d="M160 34 L162 40 L168 42 L162 44 L160 50 L158 44 L152 42 L158 40 Z" />
        <path d="M36 52 L37.5 56.5 L42 58 L37.5 59.5 L36 64 L34.5 59.5 L30 58 L34.5 56.5 Z" />
        <circle cx="176" cy="86" r="2.5" />
        <circle cx="26" cy="110" r="2.5" />
      </g>
    </svg>
  );
}
