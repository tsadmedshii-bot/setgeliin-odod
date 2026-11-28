// Хөвсгөр бөөрөнхий үүл — тайвшрал өгдөг хөөрхөн дүрслэл (оригинал inline SVG).
export default function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Хөвсгөр бөөрөнхий үүл" fill="none">
      <defs>
        <radialGradient id="cloud-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cloud-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f6f0fe" />
          <stop offset="100%" stopColor="#e2d4fa" />
        </linearGradient>
        <clipPath id="cloud-clip">
          <circle cx="62" cy="108" r="30" />
          <circle cx="100" cy="86" r="38" />
          <circle cx="140" cy="106" r="30" />
          <ellipse cx="100" cy="130" rx="63" ry="30" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="88" fill="url(#cloud-glow)" />

      {/* Хөвсгөр үүлний бие + нүүр — бага зэрэг томруулсан */}
      <g transform="translate(100 106) scale(1.12) translate(-100 -106)">
        <g fill="url(#cloud-body)">
          <circle cx="62" cy="108" r="30" />
          <circle cx="100" cy="86" r="38" />
          <circle cx="140" cy="106" r="30" />
          <ellipse cx="100" cy="130" rx="63" ry="30" />
        </g>

        {/* Сүүдэр + гэрэл (үүлний дотор) */}
        <g clipPath="url(#cloud-clip)">
          <ellipse cx="100" cy="156" rx="64" ry="20" fill="#cbb2f2" opacity="0.45" />
          <ellipse cx="76" cy="80" rx="34" ry="16" fill="#ffffff" opacity="0.9" />
        </g>

        {/* Нойрмог жаргалтай нүд */}
        <path d="M74 112 Q82 104 90 112" stroke="#6b4fa3" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M110 112 Q118 104 126 112" stroke="#6b4fa3" strokeWidth="3.5" strokeLinecap="round" />

        {/* Инээмсэглэл */}
        <path d="M92 126 Q100 133 108 126" stroke="#6b4fa3" strokeWidth="3.5" strokeLinecap="round" />

        {/* Хацар */}
        <circle cx="68" cy="124" r="6" fill="#ffb3d1" opacity="0.8" />
        <circle cx="132" cy="124" r="6" fill="#ffb3d1" opacity="0.8" />

        {/* Үүлний доорх зөөлөн сүүдэр */}
        <ellipse cx="100" cy="168" rx="52" ry="8" fill="#3b1f6e" opacity="0.12" />
      </g>

      {/* Гялалзсан одод */}
      <g fill="#f6c453">
        <path d="M164 40 L166 46 L172 48 L166 50 L164 56 L162 50 L156 48 L162 46 Z" />
        <path d="M34 58 L35.5 62.5 L40 64 L35.5 65.5 L34 70 L32.5 65.5 L28 64 L32.5 62.5 Z" />
      </g>
      <g fill="#ffffff">
        <circle cx="178" cy="92" r="2.5" />
        <circle cx="24" cy="116" r="2.5" />
      </g>
    </svg>
  );
}
