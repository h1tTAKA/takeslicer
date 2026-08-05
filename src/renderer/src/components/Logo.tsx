// takeslicer 로고 — 미러 파형 클립이 슬라이스로 두 조각 나 어긋난 마크(그라디언트 듀오톤) + 워드마크.
// 왼쪽 아이콘 + 오른쪽 워드마크 락업. 순수 인라인 SVG(의존성 0).
function Logo(): React.JSX.Element {
  return (
    <h1 className="logo">
      <svg className="logo__mark" width="36" height="36" viewBox="0 0 40 40" fill="none" aria-label="takeslicer">
        <defs>
          <linearGradient id="ts-wave" x1="0" y1="8" x2="0" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8affca" />
            <stop offset="1" stopColor="#22a862" />
          </linearGradient>
          <linearGradient id="ts-wave-dim" x1="0" y1="8" x2="0" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2fb870" />
            <stop offset="1" stopColor="#177a48" />
          </linearGradient>
        </defs>
        {/* 뒤 조각(어둡게, 아래로 어긋남) */}
        <path
          d="M4 20 L6.5 15 L9 8 L11.5 13.5 L14 6 L16.5 12 L18.5 9.5 L18.5 30.5 L16.5 28 L14 34 L11.5 26.5 L9 32 L6.5 25 L4 20 Z"
          fill="url(#ts-wave-dim)"
          transform="translate(1.5 2)"
        />
        {/* 앞 조각(밝게, 위로 어긋남) — 슬라이스로 갈라진 파형 클립 */}
        <path
          d="M4 20 L6.5 15 L9 8 L11.5 13.5 L14 6 L16.5 12 L18.5 9.5 L18.5 30.5 L16.5 28 L14 34 L11.5 26.5 L9 32 L6.5 25 L4 20 Z"
          fill="url(#ts-wave)"
          transform="translate(17 -2)"
        />
      </svg>
      <span className="logo__word">
        <span className="logo__word-take">take</span>Slicer
      </span>
    </h1>
  )
}

export default Logo
