import { RenderConfig, SliceResult } from '../types'
import { detectRegion } from './detect'

// 구간을 0초부터 마스킹 렌더한다. 무음이면 null(스킵).
// 구간 안 마지막 소리 지점에서 tail 만큼만 남기고 끊는다(경계 넘어 다음 구간까지 따라가지 않음).
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

  // 구간 [regStart, regEnd) 안에서만 마지막 활성 샘플을 찾는다. 경계를 넘어 따라가지 않음.
  // renderEnd = 마지막 소리 + tail → 구간 끝쯤에서 끊기고 꼬리(음절 여운·다음 구간 살짝)만 남는다.
  let lastActive = -1
  for (let i = regStart; i < regEnd; i++) {
    let peak = 0
    for (let c = 0; c < chans.length; c++) {
      const a = Math.abs(chans[c][i])
      if (a > peak) peak = a
    }
    if (peak > thr) lastActive = i
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

/** self-check: 무음+톤 가짜 버퍼로 슬라이스 검증(앞 패딩 0, 위치 보존, tail이 경계 넘어 이어져도 구간 기준 끊김). */
export function _assertSlice(): void {
  const sr = 1000
  const data = new Float32Array(1000)
  for (let i = 300; i < 650; i++) data[i] = 0.5 // 300~649 톤(구간 0.6s 경계 넘어 계속됨 — 따라가면 안 됨)
  const fake = {
    numberOfChannels: 1,
    length: 1000,
    sampleRate: sr,
    getChannelData: () => data
  } as unknown as AudioBuffer
  const cfg: RenderConfig = { rmsThreshold: 0.1, minActiveMs: 50, tailSec: 0.05 } // tail 50샘플

  // 구간 0.3~0.6s. 톤이 뒤로 계속 이어져도 구간 안 마지막 활성(599)+tail(50) = 649 에서 끊긴다.
  const r = sliceRegion(fake, '싸비', 'main', 0.3, 0.6, cfg)
  if (!r) throw new Error('slice self-check: null 아님 기대')
  if (r.length !== 649) throw new Error(`slice self-check: length ${r.length} !== 649 (구간 기준 끊김)`)
  const out = r.channelData[0]
  if (out[299] !== 0) throw new Error('slice self-check: 앞 패딩 0 아님')
  if (out[300] !== 0.5) throw new Error('slice self-check: regStart 위치 보존 실패')
  if (out[648] !== 0.5) throw new Error('slice self-check: tail 위치 보존 실패')

  // 무음 구간(0.7~0.9s) → 스킵(null)
  if (sliceRegion(fake, '간주', 'main', 0.7, 0.9, cfg) !== null) throw new Error('slice self-check: 무음 스킵 실패')
}
