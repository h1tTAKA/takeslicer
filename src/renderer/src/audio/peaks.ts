// AudioBuffer를 픽셀 열(columns)개로 요약한다. 각 열 = 그 구간 샘플들의 최소/최대(모든 채널 통합).
// 초당 48000샘플을 다 그릴 수 없으니, 픽셀마다 min~max 세로막대로 파형을 그린다(표준 다운샘플링).

export interface Peaks {
  min: Float32Array
  max: Float32Array
}

export function computePeaks(buffer: AudioBuffer, columns: number): Peaks {
  const min = new Float32Array(Math.max(columns, 0))
  const max = new Float32Array(Math.max(columns, 0))
  if (columns <= 0) return { min, max }

  const chans: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c))
  const total = buffer.length
  const per = total / columns // 한 픽셀 열이 담당하는 샘플 수(소수 가능)

  for (let x = 0; x < columns; x++) {
    const start = Math.floor(x * per)
    const end = Math.min(total, Math.floor((x + 1) * per))
    let lo = 0
    let hi = 0
    let seen = false
    for (let i = start; i < end; i++) {
      for (let c = 0; c < chans.length; c++) {
        const v = chans[c][i]
        if (!seen) {
          lo = v
          hi = v
          seen = true
        } else {
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      }
    }
    min[x] = lo // 샘플 없는 열(무음/빈)은 0
    max[x] = hi
  }
  return { min, max }
}

/** self-check: 가짜 버퍼로 peak 계산 검증. 로직 깨지면 throw. */
export function _assertPeaks(): void {
  const data = new Float32Array([-1, -0.5, 0, 0.5, 1, 0.5, 0, -0.5])
  const fake = {
    numberOfChannels: 1,
    length: data.length,
    getChannelData: () => data
  } as unknown as AudioBuffer
  const { min, max } = computePeaks(fake, 4) // 열마다 2샘플
  const eq = (a: number, b: number, m: string): void => {
    if (a !== b) throw new Error(`peaks self-check 실패: ${m} (${a} !== ${b})`)
  }
  eq(min[0], -1, 'col0 min')
  eq(max[0], -0.5, 'col0 max')
  eq(min[2], 0.5, 'col2 min')
  eq(max[2], 1, 'col2 max')
}
