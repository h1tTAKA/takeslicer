import { memo, useEffect, useMemo, useRef } from 'react'
import { computePeaks } from '../audio/peaks'

export interface RegionMark {
  x: number // 경계 x위치(px, 전체 css 스케일)
  color: string // 구간별 색상
}

interface Props {
  buffer: AudioBuffer
  width: number // 트랙 전체 css 폭 (= 길이 × 공유 pxPerSec). 가로 확대 시 매우 커짐
  height: number
  marks: RegionMark[] // 구간 경계선(색상별)
  color?: string
  threshold?: number // 있으면 이 진폭에 게이트 가이드선
  viewStart?: number // 화면에 보이는 구간(plot-local css px). 있으면 그 창만 네이티브 해상도로 그림(windowing)
  viewEnd?: number
}

const PEAK_RES = 16000 // peak 테이블 해상도 — 버퍼당 1회. 축소(전체폭 ≤ 이 값)일 때 이걸로 다운샘플
const MARGIN = 400 // 보이는 창 밖으로 미리 그려둘 여유(px) — 스크롤 시 빈칸 방지

// 트랙 파형. viewStart/End 있으면 "보이는 창"만 캔버스로 그림 → 백킹=화면픽셀이라 어떤 배율에서도 선명.
// 전체폭이 테이블 해상도보다 크면(확대) 보이는 창을 원본 샘플로 직접 min/max, 아니면 테이블에서 다운샘플.
function TrackWaveform({
  buffer,
  width,
  height,
  marks,
  color = '#6988e6',
  threshold,
  viewStart,
  viewEnd
}: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  // peak 테이블 + 채널 데이터 + gain: buffer당 1회. (배율 바뀌어도 재계산 안 함)
  const { peaks, chans, gain } = useMemo(() => {
    const p = computePeaks(buffer, PEAK_RES)
    const cs: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) cs.push(buffer.getChannelData(c))
    let peakAbs = 0
    for (let i = 0; i < PEAK_RES; i++) {
      const a = Math.max(Math.abs(p.min[i]), Math.abs(p.max[i]))
      if (a > peakAbs) peakAbs = a
    }
    return { peaks: p, chans: cs, gain: peakAbs > 0.001 ? Math.min(0.9 / peakAbs, 8) : 0 }
  }, [buffer])

  const W = Math.max(1, width)
  // 뷰 정보 없으면 전체(0..W) — 안전장치: 절대 트랙 잘리지 않게.
  const vs = viewStart ?? 0
  const ve = viewEnd ?? W
  const drawLeft = Math.max(0, Math.min(W, Math.floor(vs - MARGIN)))
  const drawRight = Math.max(0, Math.min(W, Math.ceil(ve + MARGIN)))
  const drawW = Math.max(1, drawRight - drawLeft)
  const visible = drawRight > drawLeft

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = drawW * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, drawW, height)
    if (!visible) return

    const n = buffer.length
    const useRaw = W > PEAK_RES // 확대해서 픽셀당 샘플이 테이블 버킷보다 촘촘 → 원본 직접
    const clamp = (v: number): number => Math.max(-1, Math.min(1, v * gain))
    const mid = height / 2

    ctx.fillStyle = color
    for (let px = 0; px < drawW; px++) {
      const cssX = drawLeft + px
      let lo: number
      let hi: number
      if (useRaw) {
        let s0 = Math.floor((cssX / W) * n)
        let s1 = Math.floor(((cssX + 1) / W) * n)
        if (s1 <= s0) s1 = s0 + 1
        if (s1 > n) s1 = n
        if (s0 > n) s0 = n
        lo = Infinity
        hi = -Infinity
        for (let i = s0; i < s1; i++) {
          for (let c = 0; c < chans.length; c++) {
            const v = chans[c][i]
            if (v < lo) lo = v
            if (v > hi) hi = v
          }
        }
        if (lo > hi) {
          lo = 0
          hi = 0
        }
      } else {
        const p0 = Math.floor((cssX / W) * PEAK_RES)
        let p1 = Math.floor(((cssX + 1) / W) * PEAK_RES)
        if (p1 <= p0) p1 = p0 + 1
        if (p1 > PEAK_RES) p1 = PEAK_RES
        lo = peaks.min[p0]
        hi = peaks.max[p0]
        for (let p = p0 + 1; p < p1; p++) {
          if (peaks.min[p] < lo) lo = peaks.min[p]
          if (peaks.max[p] > hi) hi = peaks.max[p]
        }
      }
      const yMax = mid - clamp(hi) * mid
      const yMin = mid - clamp(lo) * mid
      ctx.fillRect(px, yMax, 1, Math.max(1, yMin - yMax))
    }

    // 게이트 가이드선(파형과 같은 gain)
    if (threshold && threshold > 0 && gain > 0) {
      const ty = clamp(threshold) * mid
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect(0, mid - ty, drawW, 1)
      ctx.fillRect(0, mid + ty, drawW, 1)
    }
    // 구간 경계선 (marks.x = 전체 css → 캔버스 로컬 = x - drawLeft)
    for (const m of marks) {
      const lx = m.x - drawLeft
      if (lx >= 0 && lx < drawW) {
        ctx.fillStyle = m.color
        ctx.fillRect(Math.round(lx), 0, 1, height)
      }
    }
  }, [peaks, chans, gain, buffer, W, height, color, threshold, marks, drawLeft, drawW, visible])

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', left: `${drawLeft}px`, top: 0, width: `${drawW}px`, height: `${height}px` }}
    />
  )
}

export default memo(TrackWaveform)
