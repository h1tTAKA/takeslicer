// 시간 표시/입력은 "mm:ss"가 직관적이지만, 슬라이스 계산은 초(number)가 편하다.
// 그래서 내부 저장은 초, 화면 입출력만 "mm:ss"로 변환한다.

/** 초 → "m:ss" (예: 92 → "1:32"). 음수/비정상은 "0:00". */
export function secToMMSS(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** "m:ss" 또는 순수 초 문자열 → 초. 잘못된 형식은 NaN. */
export function mmssToSec(mmss: string): number {
  const t = mmss.trim()
  if (t === '') return NaN
  const parts = t.split(':')
  if (parts.length === 1) {
    const s = Number(parts[0])
    return Number.isFinite(s) ? s : NaN
  }
  if (parts.length === 2) {
    const m = Number(parts[0])
    const s = Number(parts[1])
    if (!Number.isFinite(m) || !Number.isFinite(s)) return NaN
    return m * 60 + s
  }
  return NaN
}

/** self-check: 로직 깨지면 throw. `node`로 이 파일 로직 검증용(앱 실행 시엔 호출 안 함). */
export function _assertTimeUtils(): void {
  const eq = (a: unknown, b: unknown, msg: string): void => {
    if (a !== b) throw new Error(`time self-check 실패: ${msg} (${a} !== ${b})`)
  }
  eq(secToMMSS(92), '1:32', 'secToMMSS(92)')
  eq(secToMMSS(0), '0:00', 'secToMMSS(0)')
  eq(secToMMSS(5), '0:05', 'secToMMSS(5) 0패딩')
  eq(secToMMSS(-3), '0:00', '음수 방어')
  eq(mmssToSec('1:32'), 92, "mmssToSec('1:32')")
  eq(mmssToSec('45'), 45, '순수 초')
  eq(Number.isNaN(mmssToSec('')), true, '빈 문자열 NaN')
  eq(Number.isNaN(mmssToSec('a:b')), true, '잘못된 형식 NaN')
}
