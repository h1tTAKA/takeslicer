import { useEffect, useMemo, useRef, useState } from 'react'
import { IconZoom } from '@tabler/icons-react'
import { Region, TakeFile } from '../types'
import { secToMMSS } from '../utils/time'
import TrackWaveform from './TrackWaveform'

const GUTTER = 110 // 트랙명 거터 폭(px)
const ROW_GAP = 8 // 라벨-플롯 사이 간격(css .waveform__row gap)
const PLOT_LEFT = GUTTER + ROW_GAP // 파형 실제 시작 x (재생헤드·눈금·클릭 기준)

// 시간 눈금 간격: 화면에 ~12개 이하로 떨어지게 고른다.
function niceStep(dur: number): number {
  for (const c of [5, 10, 15, 30, 60, 120, 300]) if (dur / c <= 12) return c
  return 600
}

interface Props {
  regions: Region[]
  takes: TakeFile[]
  instTake: TakeFile | null
  currentTime: number
  onSeek: (sec: number) => void
  onRegionUpdate: (id: string, patch: Partial<Region>) => void
  onRegionCreate: (start: number, end: number) => void
}

type DragMode = 'start' | 'end' | 'move'
const MIN_LEN = 0.05 // 구간 최소 폭(초)

// 트랙들을 공유 시간축으로 스택하는 컨테이너. 모든 트랙이 같은 pxPerSec을 써야 경계선이 일직선으로 맞는다.
function WaveformView({
  regions,
  takes,
  instTake,
  currentTime,
  onSeek,
  onRegionUpdate,
  onRegionCreate
}: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [rowH, setRowH] = useState(40) // 세로(트랙 높이) px — 파형 크게/작게 보기
  const [createRange, setCreateRange] = useState<{ s: number; e: number } | null>(null) // 생성 드래그 프리뷰

  // 드래그 상태 + 최신 값(스케일/콜백)을 ref로 → window 리스너가 stale closure 안 겪게.
  const dragRef = useRef<{ mode: DragMode; id: string; x0: number; s0: number; e0: number } | null>(null)
  const createRef = useRef<{ rectLeft: number; startTime: number; s: number; e: number } | null>(null)
  const liveRef = useRef({
    pxPerSec: 0,
    maxDuration: 1,
    onRegionUpdate,
    onRegionCreate,
    setCreateRange
  })
  const handlersRef = useRef<{
    move: (e: MouseEvent) => void
    up: () => void
    cMove: (e: MouseEvent) => void
    cUp: () => void
  } | null>(null)
  if (!handlersRef.current) {
    const move = (e: MouseEvent): void => {
      const d = dragRef.current
      const { pxPerSec, maxDuration, onRegionUpdate: update } = liveRef.current
      if (!d || pxPerSec <= 0) return
      const dt = (e.clientX - d.x0) / pxPerSec
      if (d.mode === 'start') {
        update(d.id, { start: Math.max(0, Math.min(d.s0 + dt, d.e0 - MIN_LEN)) })
      } else if (d.mode === 'end') {
        update(d.id, { end: Math.max(d.s0 + MIN_LEN, Math.min(d.e0 + dt, maxDuration)) })
      } else {
        const len = d.e0 - d.s0
        const start = Math.max(0, Math.min(d.s0 + dt, maxDuration - len))
        update(d.id, { start, end: start + len })
      }
    }
    const up = (): void => {
      dragRef.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    // 빈 곳 드래그 → 새 구간 프리뷰
    const cMove = (e: MouseEvent): void => {
      const c = createRef.current
      const { pxPerSec, maxDuration, setCreateRange: setRange } = liveRef.current
      if (!c || pxPerSec <= 0) return
      const t = Math.max(0, Math.min((e.clientX - c.rectLeft) / pxPerSec, maxDuration))
      c.s = Math.min(c.startTime, t)
      c.e = Math.max(c.startTime, t)
      setRange({ s: c.s, e: c.e })
    }
    const cUp = (): void => {
      const c = createRef.current
      const { onRegionCreate: create, setCreateRange: setRange } = liveRef.current
      window.removeEventListener('mousemove', cMove)
      window.removeEventListener('mouseup', cUp)
      setRange(null)
      if (c && c.e - c.s >= MIN_LEN) create(c.s, c.e)
      createRef.current = null
    }
    handlersRef.current = { move, up, cMove, cUp }
  }

  const beginDrag = (e: React.MouseEvent, r: Region, mode: DragMode): void => {
    e.stopPropagation() // 파형 seek/다른 핸들과 분리
    e.preventDefault()
    dragRef.current = { mode, id: r.id, x0: e.clientX, s0: r.start, e0: r.end }
    window.addEventListener('mousemove', handlersRef.current!.move)
    window.addEventListener('mouseup', handlersRef.current!.up)
  }

  // 구간 바 빈 곳 mousedown → 생성 드래그(블록은 stopPropagation이라 여기 안 옴).
  const beginCreate = (e: React.MouseEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = pxPerSec > 0 ? Math.max(0, Math.min((e.clientX - rect.left) / pxPerSec, maxDuration)) : 0
    createRef.current = { rectLeft: rect.left, startTime: t, s: t, e: t }
    setCreateRange({ s: t, e: t })
    window.addEventListener('mousemove', handlersRef.current!.cMove)
    window.addEventListener('mouseup', handlersRef.current!.cUp)
  }

  // 컨테이너 실제 폭 측정(캔버스는 픽셀 폭 필요). 창 크기 바뀌면 갱신.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 공유 시간축 길이 = 실제 오디오(가장 긴 트랙) 기준. 폭에 딱 맞춤.
  // 구간이 오디오보다 길면 경계선은 화면 밖으로 잘림(=오디오 범위 밖 신호) — 파형은 항상 꽉 차게 유지.
  const plotWidth = Math.max(0, width - PLOT_LEFT)
  // 인스트 포함 가장 긴 길이(인스트 = 노래 전체 길이 레퍼런스).
  const durations = [...takes.map((t) => t.duration), ...(instTake ? [instTake.duration] : [])]
  const trackMax = durations.length > 0 ? Math.max(...durations) : 0
  const validEnds = regions.map((r) => r.end).filter((v) => Number.isFinite(v))
  // 트랙/인스트 있으면 그 길이 기준, 없으면(파형 없음) 구간 끝 기준.
  const maxDuration = trackMax > 0 ? trackMax : Math.max(...validEnds, 1)
  const pxPerSec = plotWidth > 0 ? plotWidth / maxDuration : 0
  liveRef.current = { pxPerSec, maxDuration, onRegionUpdate, onRegionCreate, setCreateRange } // 드래그 리스너가 읽을 최신 값

  useEffect(() => {
    const h = handlersRef.current
    return () => {
      if (h) {
        window.removeEventListener('mousemove', h.move)
        window.removeEventListener('mouseup', h.up)
        window.removeEventListener('mousemove', h.cMove)
        window.removeEventListener('mouseup', h.cUp)
      }
    }
  }, [])

  // 구간 경계 x위치(px) — 각 트랙 캔버스에 넘겨 수직선으로. 유효한 값만.
  const boundaries = useMemo(
    () =>
      regions
        .flatMap((r) => [r.start, r.end])
        .filter((t) => Number.isFinite(t))
        .map((t) => t * pxPerSec),
    [regions, pxPerSec]
  )
  const ticks: number[] = []
  const step = niceStep(maxDuration)
  for (let t = 0; t <= maxDuration; t += step) ticks.push(t)

  return (
    <div className="waveform" ref={ref}>
      <div className="waveform__header">
        <h2>파형 검증</h2>
        {instTake && <span className="waveform__time">{secToMMSS(currentTime)}</span>}
        {(takes.length > 0 || instTake) && (
          <label className="waveform__zoom">
            <IconZoom size={16} stroke={2} />
            <input
              type="range"
              min={24}
              max={320}
              step={4}
              value={rowH}
              onChange={(e) => setRowH(Number(e.target.value))}
            />
          </label>
        )}
      </div>
      {takes.length === 0 && !instTake ? (
        <p className="waveform__empty">트랙을 업로드하면 파형이 여기 표시됩니다.</p>
      ) : (
        <>
          {pxPerSec > 0 && (
            <div className="waveform__rulers">
              <div
                className="waveform__regionbar"
                style={{ marginLeft: PLOT_LEFT, width: plotWidth }}
                onMouseDown={beginCreate}
              >
                {createRange && (
                  <div
                    className="waveform__region-preview"
                    style={{
                      left: createRange.s * pxPerSec,
                      width: Math.max(1, (createRange.e - createRange.s) * pxPerSec)
                    }}
                  />
                )}
                {regions
                  .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end))
                  .map((r) => (
                    <div
                      key={r.id}
                      className="waveform__region"
                      style={{
                        left: r.start * pxPerSec,
                        width: Math.max(2, (r.end - r.start) * pxPerSec)
                      }}
                      title={`${r.name} (드래그로 조절)`}
                      onMouseDown={(e) => beginDrag(e, r, 'move')}
                    >
                      <span
                        className="waveform__region-handle waveform__region-handle--l"
                        onMouseDown={(e) => beginDrag(e, r, 'start')}
                      />
                      <span className="waveform__region-name">{r.name}</span>
                      <span
                        className="waveform__region-handle waveform__region-handle--r"
                        onMouseDown={(e) => beginDrag(e, r, 'end')}
                      />
                    </div>
                  ))}
              </div>
              <div className="waveform__ticks" style={{ marginLeft: PLOT_LEFT, width: plotWidth }}>
                {ticks.map((t) => (
                  <span key={t} style={{ left: t * pxPerSec }}>
                    {secToMMSS(t)}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div
            className="waveform__rows"
            onClick={(e) => {
              const el = e.currentTarget
              const x = e.clientX - el.getBoundingClientRect().left - PLOT_LEFT + el.scrollLeft
              if (x >= 0 && pxPerSec > 0) onSeek(x / pxPerSec)
            }}
          >
            {instTake && pxPerSec > 0 && (
              <div
                className="waveform__playhead"
                style={{ left: PLOT_LEFT + currentTime * pxPerSec }}
              />
            )}
            {instTake && (
              <div className="waveform__row waveform__row--inst">
                <span className="waveform__label" title={instTake.name}>
                  INST · {instTake.name}
                </span>
                <div className="waveform__plot" style={{ width: instTake.duration * pxPerSec, height: rowH }}>
                  {pxPerSec > 0 && (
                    <TrackWaveform
                      buffer={instTake.audioBuffer}
                      width={instTake.duration * pxPerSec}
                      height={rowH}
                      boundaries={boundaries}
                      color="#4a9d6a"
                    />
                  )}
                </div>
              </div>
            )}
            {takes.map((t) => (
              <div key={t.id} className="waveform__row">
                <span className="waveform__label" title={t.name}>
                  {t.name}
                </span>
                <div className="waveform__plot" style={{ width: t.duration * pxPerSec, height: rowH }}>
                  {pxPerSec > 0 && (
                    <TrackWaveform
                      buffer={t.audioBuffer}
                      width={t.duration * pxPerSec}
                      height={rowH}
                      boundaries={boundaries}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default WaveformView
