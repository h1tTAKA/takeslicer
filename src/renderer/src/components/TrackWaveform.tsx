import { useEffect, useMemo, useRef } from 'react'
import { computePeaks } from '../audio/peaks'

export interface RegionMark {
  x: number // 경계 x위치(px, 전체 css 스케일)
  color: string // 구간별 색상
}

interface Props {
  buffer: AudioBuffer
  width: number // css px (= 트랙 길이 × 공유 pxPerSec). 가로 확대 시 매우 커질 수 있음
  height: number
  marks: RegionMark[] // 구간 경계선(색상별). 파형 위에 수직선으로.
  color?: string
}

const MAX_COLS = 8000 // 캔버스 백킹 해상도 상한(브라우저 최대 캔버스 초과 방지). 초과분은 CSS로 늘림.

// 트랙 1개 파형을 캔버스에 그린다. peaks(min/max)를 픽셀 열마다 세로막대로 + 구간 경계선(색상별).
function TrackWaveform({ buffer, width, height, marks, color = '#6988e6' }: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const cssW = Math.max(1, width) // 실제 화면 폭(전체)
  const cols = Math.min(Math.floor(cssW), MAX_COLS) // 그리는 해상도(상한)
  const scaleX = cols / cssW // 전체 css x → 그리기 x 축소 비율
  // 폭/버퍼 안 바뀌면 peak 재계산 안 함(무거운 계산 메모이즈).
  const peaks = useMemo(() => computePeaks(buffer, cols), [buffer, cols])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    // 백킹은 cols×dpr(상한 있음), CSS는 전체 폭(cssW) → 브라우저가 늘려줌. 초광폭에서도 안 깨짐.
    canvas.width = cols * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, cols, height)
    ctx.fillStyle = color

    // 정규화: 보컬은 진폭이 작아 ±1 스케일로 그리면 납작함. 트랙 최대값 기준으로 키운다(상한 8배, 무음 flat).
    let peakAbs = 0
    for (let x = 0; x < cols; x++) {
      const a = Math.max(Math.abs(peaks.min[x]), Math.abs(peaks.max[x]))
      if (a > peakAbs) peakAbs = a
    }
    const gain = peakAbs > 0.001 ? Math.min(0.9 / peakAbs, 8) : 0
    const clamp = (v: number): number => Math.max(-1, Math.min(1, v * gain))

    const mid = height / 2
    for (let x = 0; x < cols; x++) {
      const yMax = mid - clamp(peaks.max[x]) * mid
      const yMin = mid - clamp(peaks.min[x]) * mid
      ctx.fillRect(x, yMax, 1, Math.max(1, yMin - yMax))
    }

    // 구간 경계선(색상별). marks.x는 전체 css 좌표 → scaleX로 그리기 좌표로.
    for (const m of marks) {
      const mx = m.x * scaleX
      if (mx >= 0 && mx < cols) {
        ctx.fillStyle = m.color
        ctx.fillRect(Math.round(mx), 0, 1, height)
      }
    }
  }, [peaks, cols, scaleX, height, color, marks])

  // CSS 폭은 전체(cssW). 백킹이 작아도 브라우저가 이 폭으로 늘려 표시.
  return <canvas ref={ref} style={{ width: `${cssW}px`, height: `${height}px` }} />
}

export default TrackWaveform
