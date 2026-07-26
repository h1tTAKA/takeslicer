import { RenderConfig, SliceResult } from '../types'
import { detectRegion } from './detect'

// 구간을 0초부터 마스킹 렌더한다. 무음이면 null(스킵).
// 경계(regEnd)에서 소리가 이어지면 파형이 실제로 잦아드는 지점까지 확장(음절 안 잘리게).
export function sliceRegion(
  buffer: AudioBuffer,
  regionName: string,
  takeName: string,
  startSec: number,
  endSec: number,
  cfg: RenderConfig
): Omit<SliceResult, 'filename'> | null {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null
  if (!detectRegion(buffer, startSec, endSec, cfg).active) return null // 무음 스킵

  const sr = buffer.sampleRate
  const regStart = Math.max(0, Math.floor(startSec * sr))
  const regEnd = Math.min(buffer.length, Math.ceil(endSec * sr))
  const tailSamples = Math.max(1, Math.round(cfg.tailSec * sr))
  const thr = cfg.rmsThreshold

  const chans: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c))

  // renderEnd: regEnd를 지나서도 소리가 이어지면 계속 따라가고, regEnd 이후 tail만큼 조용해지면 멈춤.
  let lastActive = -1
  let silenceRun = 0
  for (let i = regStart; i < buffer.length; i++) {
    let peak = 0
    for (let c = 0; c < chans.length; c++) {
      const a = Math.abs(chans[c][i])
      if (a > peak) peak = a
    }
    if (peak > thr) {
      lastActive = i
      silenceRun = 0
    } else {
      silenceRun++
    }
    if (i >= regEnd && silenceRun >= tailSamples) break
  }
  if (lastActive < 0) return null
  const renderEnd = Math.min(lastActive + tailSamples, buffer.length)

  // 0초 마스킹: 길이 renderEnd 버퍼(0 초기화 = 앞 무음 패딩), regStart~renderEnd만 원본 복사(위치 보존).
  const channelData: Float32Array[] = []
  for (let c = 0; c < chans.length; c++) {
    const out = new Float32Array(renderEnd)
    out.set(chans[c].subarray(regStart, renderEnd), regStart)
    channelData.push(out)
  }
  return { regionName, takeName, channelData, sampleRate: sr, length: renderEnd }
}

/** self-check: 무음+톤 가짜 버퍼로 슬라이스 검증(앞 패딩 0, 위치 보존, 경계 확장). */
export function _assertSlice(): void {
  const sr = 1000
  const data = new Float32Array(1000)
  for (let i = 300; i < 650; i++) data[i] = 0.5 // 300~649 톤(구간 500~600 경계 0.6s를 넘어 0.65s까지 이어짐)
  const fake = {
    numberOfChannels: 1,
    length: 1000,
    sampleRate: sr,
    getChannelData: () => data
  } as unknown as AudioBuffer
  const cfg: RenderConfig = { rmsThreshold: 0.1, minActiveMs: 50, tailSec: 0.05 } // tail 50샘플

  // 구간 0.3~0.6s. 톤이 0.65s까지 이어짐 → renderEnd = 649 + 50 = 699.
  const r = sliceRegion(fake, '싸비', 'main', 0.3, 0.6, cfg)
  if (!r) throw new Error('slice self-check: null 아님 기대')
  if (r.length !== 699) throw new Error(`slice self-check: length ${r.length} !== 699 (경계 확장)`)
  const out = r.channelData[0]
  if (out[299] !== 0) throw new Error('slice self-check: 앞 패딩 0 아님')
  if (out[300] !== 0.5) throw new Error('slice self-check: regStart 위치 보존 실패')
  if (out[648] !== 0.5) throw new Error('slice self-check: 경계 넘은 톤 보존 실패')

  // 무음 구간(0.7~0.9s) → 스킵(null)
  if (sliceRegion(fake, '간주', 'main', 0.7, 0.9, cfg) !== null) throw new Error('slice self-check: 무음 스킵 실패')
}
