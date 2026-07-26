// 구간에 "소리가 있나"를 판정한다. 채널 최대 |sample|가 임계값(threshold)을 넘는 샘플을 활성으로 보고,
// 활성 샘플 총 길이가 minActiveMs 이상이면 "소리 있음". 마지막 활성 샘플 위치(lastActive)도 돌려준다.
// 왜 노브(threshold/minActiveMs)? 보컬은 숨소리·리버브·룸톤 때문에 고정값이 오판 → 곡마다 유저가 튜닝.

export interface RegionDetection {
  active: boolean // 이 구간에 (충분한) 소리 있나
  lastActive: number // 마지막 활성 샘플 인덱스(절대). 없으면 -1
}

// stride: 샘플 건너뛰기(기본 1=정밀). 미리보기는 stride를 키워 빠르게 근사(정확도↓, 속도↑).
export function detectRegion(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  cfg: { rmsThreshold: number; minActiveMs: number },
  stride = 1
): RegionDetection {
  const sr = buffer.sampleRate
  const start = Math.max(0, Math.floor(startSec * sr))
  const end = Math.min(buffer.length, Math.ceil(endSec * sr))
  if (start >= end) return { active: false, lastActive: -1 }

  const chans: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c))

  const thr = cfg.rmsThreshold
  let activeCount = 0
  let lastActive = -1
  for (let i = start; i < end; i += stride) {
    let peak = 0
    for (let c = 0; c < chans.length; c++) {
      const a = Math.abs(chans[c][i])
      if (a > peak) peak = a
    }
    if (peak > thr) {
      activeCount++
      lastActive = i
    }
  }
  const activeMs = ((activeCount * stride) / sr) * 1000 // stride 반영해 실제 길이 환산
  return { active: activeMs >= cfg.minActiveMs, lastActive }
}

/** self-check: 무음+톤+무음 가짜 버퍼로 판정 검증. 로직 깨지면 throw. */
export function _assertDetect(): void {
  const sr = 1000
  const data = new Float32Array(1000) // 0으로 초기화(무음)
  for (let i = 500; i < 800; i++) data[i] = 0.5 // 500~799: 톤 300샘플(=300ms)
  const fake = {
    numberOfChannels: 1,
    length: 1000,
    sampleRate: sr,
    getChannelData: () => data
  } as unknown as AudioBuffer

  const eq = (a: unknown, b: unknown, m: string): void => {
    if (a !== b) throw new Error(`detect self-check 실패: ${m} (${a} !== ${b})`)
  }
  const whole = detectRegion(fake, 0, 1, { rmsThreshold: 0.1, minActiveMs: 100 })
  eq(whole.active, true, '전체구간 톤 있음')
  eq(whole.lastActive, 799, '마지막 활성 799')

  const front = detectRegion(fake, 0, 0.5, { rmsThreshold: 0.1, minActiveMs: 100 })
  eq(front.active, false, '앞 절반은 무음')
  eq(front.lastActive, -1, '앞 절반 lastActive 없음')

  const highThr = detectRegion(fake, 0, 1, { rmsThreshold: 0.9, minActiveMs: 100 })
  eq(highThr.active, false, '임계값 0.9면 톤(0.5) 스킵')

  const tooShort = detectRegion(fake, 0, 1, { rmsThreshold: 0.1, minActiveMs: 400 })
  eq(tooShort.active, false, '최소길이 400ms > 톤 300ms 라 스킵')
}
