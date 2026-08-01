import { memo, useEffect, useMemo, useRef } from 'react'
import { computePeaks } from '../audio/peaks'

export interface RegionMark {
  x: number // 경계 x위치(px, 전체 css 스케일)
  color: string // 구간별 색상
}

interface Props {
  buffer: AudioBuffer
  width: number // css px (= 트랙 길이 × 공유 pxPerSec). 가로 확대 시 매우 커질 수 있음
  height: number
  marks: RegionMark[] // 구간 경계선(색상별)
  color?: string
  threshold?: number // 있으면 이 진폭에 수평 가이드선(게이트 레벨) — threshold 노브 시각 피드백
}

const PEAK_RES = 3000 // peak 고정 해상도 — 버퍼당 1회 계산(줌해도 재계산 안 함)
const MAX_BACK = 8000 // 캔버스 백킹 픽셀 상한(브라우저 최대 초과 방지)

// 트랙 파형 캔버스. peak는 buffer당 1회만 계산(무거움), 그리기만 폭에 맞춰 반복.
function TrackWaveform({ buffer, width, height, marks, color = '#6988e6', threshold }: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  // peak/gain은 buffer만 의존 → 줌(width) 바뀌어도 재계산 안 함.
  const { peaks, gain } = useMemo(() => {
    const p = computePeaks(buffer, PEAK_RES)
    let peakAbs = 0
    for (let i = 0; i < PEAK_RES; i++) {
      const a = Math.max(Math.abs(p.min[i]), Math.abs(p.max[i]))
      if (a > peakAbs) peakAbs = a
    }
    return { peaks: p, gain: peakAbs > 0.001 ? Math.min(0.9 / peakAbs, 8) : 0 }
  }, [buffer])

  const cssW = Math.max(1, width)
  const backW = Math.min(Math.floor(cssW), MAX_BACK) // 그리기 픽셀 폭(상한)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = backW * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, backW, height)
    ctx.fillStyle = color
    const clamp = (v: number): number => Math.max(-1, Math.min(1, v * gain))
    const mid = height / 2
    for (let x = 0; x < backW; x++) {
      const p = Math.floor((x / backW) * PEAK_RES) // 백킹 픽셀 → peak 인덱스
      const yMax = mid - clamp(peaks.max[p]) * mid
      const yMin = mid - clamp(peaks.min[p]) * mid
      ctx.fillRect(x, yMax, 1, Math.max(1, yMin - yMax))
    }
    // 게이트 가이드선: 파형과 같은 gain으로 그려 "신호 대비 threshold 높이"를 보여줌(노브 드래그 시 이동).
    if (threshold && threshold > 0 && gain > 0) {
      const ty = clamp(threshold) * mid
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect(0, mid - ty, backW, 1)
      ctx.fillRect(0, mid + ty, backW, 1)
    }
    // 구간 경계선(marks.x는 전체 css 좌표 → backW 좌표로)
    for (const m of marks) {
      const mx = (m.x / cssW) * backW
      if (mx >= 0 && mx < backW) {
        ctx.fillStyle = m.color
        ctx.fillRect(Math.round(mx), 0, 1, height)
      }
    }
  }, [peaks, gain, backW, cssW, height, color, marks, threshold])

  return <canvas ref={ref} style={{ width: `${cssW}px`, height: `${height}px` }} />
}

export default memo(TrackWaveform)
