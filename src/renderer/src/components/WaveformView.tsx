import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconTrash,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled
} from '@tabler/icons-react'
import { Region, TakeFile } from '../types'
import { secToMMSS } from '../utils/time'
import TrackWaveform from './TrackWaveform'

const GUTTER = 190 // 트랙 레인 헤더(이름·메타·삭제) 폭(px)
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
  songLength: number // 노래 길이(인스트) — 드래그 상한
  onTakeRemove: (id: string) => void
  instPlaying: boolean
  onInstToggle: () => void
  onInstStop: () => void
  onInstRemove: () => void
}

type DragMode = 'start' | 'end' | 'move'
const MIN_LEN = 0.05 // 구간 최소 폭(초)

// 구간별 색상 팔레트(눈에 딱딱 구분되게). 인덱스로 순환.
const PALETTE = ['#e8963c', '#6988e6', '#4a9d6a', '#c0569e', '#d4b13a', '#5aacc0', '#d5654a', '#8a6fd4']
const colorFor = (i: number): string => PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length]

// 트랙들을 공유 시간축으로 스택하는 컨테이너. 모든 트랙이 같은 pxPerSec을 써야 경계선이 일직선으로 맞는다.
function WaveformView({
  regions,
  takes,
  instTake,
  currentTime,
  onSeek,
  onRegionUpdate,
  onRegionCreate,
  songLength,
  onTakeRemove,
  instPlaying,
  onInstToggle,
  onInstStop,
  onInstRemove
}: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [rowH, setRowH] = useState(40) // 세로(트랙 높이) px — 파형 크게/작게 보기
  const [zoomX, setZoomX] = useState(1) // 가로(시간) 배율 — 1=폭에 맞춤, >1=확대+가로스크롤
  const [createRange, setCreateRange] = useState<{ s: number; e: number } | null>(null) // 생성 드래그 프리뷰

  // 드래그 상태 + 최신 값(스케일/콜백)을 ref로 → window 리스너가 stale closure 안 겪게.
  const dragRef = useRef<{
    mode: DragMode
    id: string
    x0: number
    s0: number
    e0: number
    link: { id: string; key: 'start' | 'end' } | null // start/end 드래그 시 연결할 이웃
    lo: number // 경계 하한
    hi: number // 경계 상한
    prevId: string | null // move 시 앞 구간(그 끝이 따라옴)
    nextId: string | null // move 시 뒤 구간(그 시작이 따라옴)
    moveLo: number // move 시작 하한
    moveHi: number // move 시작 상한
  } | null>(null)
  const createRef = useRef<{ rectLeft: number; startTime: number; s: number; e: number } | null>(null)
  const liveRef = useRef({
    pxPerSec: 0,
    bound: 1, // 드래그 상한(노래 길이)
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
      const { pxPerSec, onRegionUpdate: update } = liveRef.current
      if (!d || pxPerSec <= 0) return
      const dt = (e.clientX - d.x0) / pxPerSec
      if (d.mode === 'start') {
        const start = Math.max(d.lo, Math.min(d.s0 + dt, d.hi))
        update(d.id, { start })
        if (d.link) update(d.link.id, { end: start }) // 이전 구간 끝을 붙임(딱딱 연결)
      } else if (d.mode === 'end') {
        const end = Math.max(d.lo, Math.min(d.e0 + dt, d.hi))
        update(d.id, { end })
        if (d.link) update(d.link.id, { start: end }) // 다음 구간 시작을 붙임
      } else {
        // move: 통째 이동 + 양옆 이웃도 붙어옴(연결 유지).
        const len = d.e0 - d.s0
        const start = Math.max(d.moveLo, Math.min(d.s0 + dt, d.moveHi))
        const end = start + len
        update(d.id, { start, end })
        if (d.prevId) update(d.prevId, { end: start }) // 앞 구간 끝을 붙임
        if (d.nextId) update(d.nextId, { start: end }) // 뒤 구간 시작을 붙임
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
      const { pxPerSec, bound, setCreateRange: setRange } = liveRef.current
      if (!c || pxPerSec <= 0) return
      const t = Math.max(0, Math.min((e.clientX - c.rectLeft) / pxPerSec, bound))
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
    // 시간 순서상 바로 옆 구간을 항상 연결 → 드래그하면 이웃도 같이 붙어 딱딱 연결(틈/겹침 방지).
    const bound = liveRef.current.bound
    let link: { id: string; key: 'start' | 'end' } | null = null
    let lo = 0
    let hi = bound
    let prevId: string | null = null
    let nextId: string | null = null
    let moveLo = 0
    let moveHi = bound
    const sorted = regions
      .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end))
      .sort((a, b) => a.start - b.start)
    const idx = sorted.findIndex((x) => x.id === r.id)
    const prev = idx > 0 ? sorted[idx - 1] : null
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null
    if (mode === 'start') {
      if (prev) {
        link = { id: prev.id, key: 'end' }
        lo = prev.start + MIN_LEN
      }
      hi = r.end - MIN_LEN
    } else if (mode === 'end') {
      if (next) {
        link = { id: next.id, key: 'start' }
        hi = next.end - MIN_LEN
      }
      lo = r.start + MIN_LEN
    } else {
      // move: 양옆 이웃이 따라옴. 이동 범위 = 앞 구간 시작~뒤 구간 끝 안쪽(이웃 폭 유지).
      prevId = prev ? prev.id : null
      nextId = next ? next.id : null
      const len = r.end - r.start
      moveLo = prev ? prev.start + MIN_LEN : 0
      moveHi = (next ? next.end - MIN_LEN : bound) - len
    }
    dragRef.current = {
      mode,
      id: r.id,
      x0: e.clientX,
      s0: r.start,
      e0: r.end,
      link,
      lo,
      hi,
      prevId,
      nextId,
      moveLo,
      moveHi
    }
    window.addEventListener('mousemove', handlersRef.current!.move)
    window.addEventListener('mouseup', handlersRef.current!.up)
  }

  // 구간 바 빈 곳 mousedown → 생성 드래그(블록은 stopPropagation이라 여기 안 옴).
  const beginCreate = (e: React.MouseEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = pxPerSec > 0 ? Math.max(0, Math.min((e.clientX - rect.left) / pxPerSec, bound)) : 0
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
  const pxPerSec = plotWidth > 0 ? (plotWidth / maxDuration) * zoomX : 0
  const timelineWidth = maxDuration * pxPerSec // 가로 확대 시 실제 타임라인 폭
  const bound = songLength > 0 ? songLength : maxDuration // 드래그 상한 = 노래 길이(없으면 타임라인)
  liveRef.current = { pxPerSec, bound, onRegionUpdate, onRegionCreate, setCreateRange } // 드래그 리스너가 읽을 최신 값

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

  // 구간 경계선(색상별) — 각 트랙 캔버스에 넘김. 구간 인덱스로 색 지정.
  const regionMarks = useMemo(() => {
    const out: { x: number; color: string }[] = []
    regions.forEach((r, i) => {
      if (!Number.isFinite(r.start) || !Number.isFinite(r.end)) return
      const c = colorFor(i)
      out.push({ x: r.start * pxPerSec, color: c }, { x: r.end * pxPerSec, color: c })
    })
    return out
  }, [regions, pxPerSec])
  const ticks: number[] = []
  const step = niceStep(maxDuration)
  for (let t = 0; t <= maxDuration; t += step) ticks.push(t)

  return (
    <div className="waveform" ref={ref}>
      <div className="waveform__header">
        <h2>파형 검증</h2>
        {instTake && <span className="waveform__time">{secToMMSS(currentTime)}</span>}
        {(takes.length > 0 || instTake) && (
          <div className="waveform__zoom">
            <label className="waveform__zoom-ctl" title="가로 확대">
              <IconArrowsHorizontal size={16} stroke={2} />
              <input
                type="range"
                min={1}
                max={40}
                step={0.5}
                value={zoomX}
                onChange={(e) => setZoomX(Number(e.target.value))}
              />
            </label>
            <label className="waveform__zoom-ctl" title="세로 확대">
              <IconArrowsVertical size={16} stroke={2} />
              <input
                type="range"
                min={24}
                max={320}
                step={4}
                value={rowH}
                onChange={(e) => setRowH(Number(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>
      {takes.length === 0 && !instTake ? (
        <p className="waveform__empty">트랙을 업로드하면 파형이 여기 표시됩니다.</p>
      ) : (
        <div className="waveform__scroll">
          {pxPerSec > 0 && (
            <div className="waveform__rulers">
              <div
                className="waveform__regionbar"
                style={{ marginLeft: PLOT_LEFT, width: timelineWidth }}
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
                {regions.map((r, i) => {
                  if (!Number.isFinite(r.start) || !Number.isFinite(r.end)) return null
                  const c = colorFor(i)
                  return (
                    <div
                      key={r.id}
                      className="waveform__region"
                      style={{
                        left: r.start * pxPerSec,
                        width: Math.max(2, (r.end - r.start) * pxPerSec),
                        borderLeftColor: c,
                        backgroundColor: `${c}22`,
                        color: c
                      }}
                      title={`${r.name} (드래그로 조절)`}
                      onMouseDown={(e) => beginDrag(e, r, 'move')}
                    >
                      <span
                        className="waveform__region-handle waveform__region-handle--l"
                        style={{ borderLeftColor: c }}
                        onMouseDown={(e) => beginDrag(e, r, 'start')}
                      />
                      <span className="waveform__region-name">{r.name}</span>
                      <span
                        className="waveform__region-handle waveform__region-handle--r"
                        style={{ borderRightColor: c }}
                        onMouseDown={(e) => beginDrag(e, r, 'end')}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="waveform__ticks" style={{ marginLeft: PLOT_LEFT, width: timelineWidth }}>
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
                <div className="waveform__lanehead" onClick={(e) => e.stopPropagation()}>
                  <div className="waveform__lanehead-top">
                    <button className="waveform__lane-play" onClick={onInstToggle} aria-label="재생/일시정지">
                      {instPlaying ? <IconPlayerPauseFilled size={14} /> : <IconPlayerPlayFilled size={14} />}
                    </button>
                    <button className="waveform__lane-stop" onClick={onInstStop} aria-label="정지">
                      <IconPlayerStopFilled size={12} />
                    </button>
                    <span className="waveform__lane-name" title={instTake.name}>
                      INST · {instTake.name}
                    </span>
                    <button className="waveform__lane-del" onClick={onInstRemove} aria-label="인스트 제거">
                      <IconTrash size={14} />
                    </button>
                  </div>
                  <div className="waveform__lane-meta">
                    {secToMMSS(instTake.duration)} · {Math.round(instTake.sampleRate / 100) / 10}kHz ·{' '}
                    {instTake.numChannels}ch
                  </div>
                </div>
                <div className="waveform__plot" style={{ width: instTake.duration * pxPerSec, height: rowH }}>
                  {pxPerSec > 0 && (
                    <TrackWaveform
                      buffer={instTake.audioBuffer}
                      width={instTake.duration * pxPerSec}
                      height={rowH}
                      marks={regionMarks}
                      color="#4a9d6a"
                    />
                  )}
                </div>
              </div>
            )}
            {takes.map((t) => (
              <div key={t.id} className="waveform__row">
                <div className="waveform__lanehead" onClick={(e) => e.stopPropagation()}>
                  <div className="waveform__lanehead-top">
                    <span className="waveform__lane-name" title={t.name}>
                      {t.name}
                    </span>
                    <button
                      className="waveform__lane-del"
                      onClick={() => onTakeRemove(t.id)}
                      aria-label="트랙 제거"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                  <div className="waveform__lane-meta">
                    {secToMMSS(t.duration)} · {Math.round(t.sampleRate / 100) / 10}kHz · {t.numChannels}ch
                  </div>
                </div>
                <div className="waveform__plot" style={{ width: t.duration * pxPerSec, height: rowH }}>
                  {pxPerSec > 0 && (
                    <TrackWaveform
                      buffer={t.audioBuffer}
                      width={t.duration * pxPerSec}
                      height={rowH}
                      marks={regionMarks}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WaveformView
