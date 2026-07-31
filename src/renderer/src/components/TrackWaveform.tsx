import { useEffect, useMemo, useRef } from 'react'
import { computePeaks } from '../audio/peaks'

export interface RegionMark {
  x: number // 경계 x위치(px, 공유 스케일)
  color: string // 구간별 색상
}

interface Props {
  buffer: AudioBuffer
  width: number // css px (= 트랙 길이 × 공유 pxPerSec)
  height: number
  marks: RegionMark[] // 구간 경계선(색상별). 파형 위에 수직선으로.
  color?: string
}

// 트랙 1개 파형을 캔버스에 그린다. peaks(min/max)를 픽셀 열마다 세로막대로 + 구간 경계선(색상별).
function TrackWaveform({ buffer, width, height, marks, color = '#6988e6' }: Props): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const cols = Math.max(1, Math.floor(width))
  // 폭/버퍼 안 바뀌면 peak 재계산 안 함(무거운 계산 메모이즈).
  const peaks = useMemo(() => computePeaks(buffer, cols), [buffer, cols])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    // 레티나 대응: 실제 픽셀은 dpr배로 만들고 CSS로 줄여 선명하게.
    canvas.width = cols * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr) // 이후 CSS 좌표(cols×height)로 그림
    ctx.clearRect(0, 0, cols, height)
    ctx.fillStyle = color

    // 정규화: 보컬은 진폭이 작아 ±1 스케일로 그리면 납작함. 트랙 최대값 기준으로 키운다.
    // 상한(8배)으로 거의 무음인 트랙의 노이즈를 과하게 뻥튀기하지 않게 막음. 무음(≈0)은 flat.
    let peakAbs = 0
    for (let x = 0; x < cols; x++) {
      const a = Math.max(Math.abs(peaks.min[x]), Math.abs(peaks.max[x]))
      if (a > peakAbs) peakAbs = a
    }
    const gain = peakAbs > 0.001 ? Math.min(0.9 / peakAbs, 8) : 0
    const clamp = (v: number): number => Math.max(-1, Math.min(1, v * gain))

    const mid = height / 2
    for (let x = 0; x < cols; x++) {
      const yMax = mid - clamp(peaks.max[x]) * mid // 위(양수)
      const yMin = mid - clamp(peaks.min[x]) * mid // 아래(음수)
      ctx.fillRect(x, yMax, 1, Math.max(1, yMin - yMax)) // min~max 세로막대
    }

    // 구간 경계선(파형 위에 관통, 색상별). 이 트랙 폭 안에 드는 경계만.
    for (const m of marks) {
      if (m.x >= 0 && m.x < cols) {
        ctx.fillStyle = m.color
        ctx.fillRect(Math.round(m.x), 0, 1, height)
      }
    }
  }, [peaks, cols, height, color, marks])

  return <canvas ref={ref} style={{ width: `${cols}px`, height: `${height}px` }} />
}

export default TrackWaveform
