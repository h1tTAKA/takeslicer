// 파일명/폴더명에서 OS 금지문자를 치환한다.
const BAD = /[/\\:*?"<>|]/g

export function sanitize(name: string): string {
  const cleaned = name.replace(BAD, '_').trim()
  return cleaned.length > 0 ? cleaned : 'untitled'
}

// 슬라이스 파일명: {구간이름}{NN}{원본파일명}.wav  (NN = 그 구간 내 순번, 1부터)
export function buildFilename(regionName: string, index: number, takeName: string): string {
  const nn = String(index).padStart(2, '0')
  return `${sanitize(regionName)}${nn}${sanitize(takeName)}.wav`
}

/** self-check: 네이밍 규칙 + sanitize 검증. */
export function _assertNaming(): void {
  const eq = (a: string, b: string, m: string): void => {
    if (a !== b) throw new Error(`naming self-check 실패: ${m} (${a} !== ${b})`)
  }
  eq(buildFilename('싸비', 1, 'vocal_main'), '싸비01vocal_main.wav', '기본')
  eq(buildFilename('싸비', 12, 'harmony'), '싸비12harmony.wav', '두자리')
  eq(buildFilename('벌스/A', 2, 'a:b'), '벌스_A02a_b.wav', '금지문자 치환')
  eq(sanitize('   '), 'untitled', '공백만이면 untitled')
}
