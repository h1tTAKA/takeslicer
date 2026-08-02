import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconTrash,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled,
  IconChevronRight
} from '@tabler/icons-react'
import { Region, TakeFile, RenderConfig } from '../types'
import { secToMMSS } from '../utils/time'
import { sliceRegion } from '../audio/slice'
import TrackWaveform from './TrackWaveform'

const GUTTER = 190 // 트랙 레인 헤더(이름·메타·삭제) 폭(px)
const ROW_GAP = 8 // 라벨-플롯 사이 간격(css .waveform__row gap)
const PLOT_LEFT = GUTTER + ROW_GAP // 파형 실제 시작 x (재생헤드·눈금·클릭 기준)

// 시간 눈금 간격: 픽셀 밀도(pxPerSec) 기준으로 라벨이 ~80px 이상 벌어지는 최소 간격.
function niceStep(pxPerSec: number): number {
  if (pxPerSec <= 0) return 60
  const target = 80 / pxPerSec
  for (const c of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (c >= target) return c
  return 600
}

// SliceResult.channelData를 TrackWaveform이 읽을 수 있게 AudioBuffer 흉내.
function fakeBuffer(ch: Float32Array[], length: number, sampleRate: number): AudioBuffer {
  return {
    numberOfChannels: ch.length,
    length,
    sampleRate,
    getChannelData: (c: number) => ch[c]
  } as unknown as AudioBuffer
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
  config: RenderConfig
}

type DragMode = 'start' | 'end' | 'move'
const MIN_LEN = 0.05 // 구간 최소 폭(초)

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
  onInstRemove,
  config
}: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0) // 가로 스크롤 위치 — 파형은 보이는 창만 그림(windowing)
  const scrollRaf = useRef(0)
  const [rowH, setRowH] = useState(40)
  const [zoomX, setZoomX] = useState(1)
  const [createRange, setCreateRange] = useState<{ s: number; e: number } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null) // 펼친 트랙(구간별 결과 미리보기)

  // 스크롤 위치 추적(rAF로 프레임당 1회). 뷰포트 폭은 이미 재는 width를 그대로 씀(측정 이중화 방지).
  const onScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const left = e.currentTarget.scrollLeft
    if (scrollRaf.current) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0
      setScrollLeft(left)
    })
  }

  const dragRef = useRef<{
    mode: DragMode
    id: string
    x0: number
    s0: number
    e0: number
    link: { id: string; key: 'start' | 'end' } | null
    lo: number
    hi: number
    prevId: string | null
    nextId: string | null
    moveLo: number
    moveHi: number
  } | null>(null)
  const createRef = useRef<{ rectLeft: number; startTime: number; s: number; e: number } | null>(null)
  const liveRef = useRef({ pxPerSec: 0, bound: 1, onRegionUpdate, onRegionCreate, setCreateRange })
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
        if (d.link) update(d.link.id, { end: start })
      } else if (d.mode === 'end') {
        const end = Math.max(d.lo, Math.min(d.e0 + dt, d.hi))
        update(d.id, { end })
        if (d.link) update(d.link.id, { start: end })
      } else {
        const len = d.e0 - d.s0
        const start = Math.max(d.moveLo, Math.min(d.s0 + dt, d.moveHi))
        const end = start + len
        update(d.id, { start, end })
        if (d.prevId) update(d.prevId, { end: start })
        if (d.nextId) update(d.nextId, { start: end })
      }
    }
    const up = (): void => {
      dragRef.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
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
    e.stopPropagation()
    e.preventDefault()
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
      prevId = prev ? prev.id : null
      nextId = next ? next.id : null
      const len = r.end - r.start
      moveLo = prev ? prev.start + MIN_LEN : 0
      moveHi = (next ? next.end - MIN_LEN : bound) - len
    }
    // 인접 구간이 둘 다 MIN_LEN 미만이면 lo>hi로 역전될 수 있음 → 클램프가 정의되게 hi를 lo 아래로 안 내림(그 자리 고정).
    if (hi < lo) hi = lo
    if (moveHi < moveLo) moveHi = moveLo
    dragRef.current = { mode, id: r.id, x0: e.clientX, s0: r.start, e0: r.end, link, lo, hi, prevId, nextId, moveLo, moveHi }
    window.addEventListener('mousemove', handlersRef.current!.move)
    window.addEventListener('mouseup', handlersRef.current!.up)
  }

  const beginCreate = (e: React.MouseEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = pxPerSec > 0 ? Math.max(0, Math.min((e.clientX - rect.left) / pxPerSec, bound)) : 0
    createRef.current = { rectLeft: rect.left, startTime: t, s: t, e: t }
    setCreateRange({ s: t, e: t })
    window.addEventListener('mousemove', handlersRef.current!.cMove)
    window.addEventListener('mouseup', handlersRef.current!.cUp)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // DAW식 줌: Cmd/Ctrl 누르고 스크롤 — 상하=세로, 좌우(또는 Shift)=가로. rAF로 프레임당 1회만.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let accX = 0
    let accY = 0
    let raf = 0
    const flush = (): void => {
      raf = 0
      if (accY !== 0) setRowH((h) => Math.max(24, Math.min(320, h - accY * 1.1)))
      if (accX !== 0) setZoomX((z) => Math.max(1, Math.min(40, z - accX * 0.06)))
      accX = 0
      accY = 0
    }
    const onWheel = (e: WheelEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (horizontal) accX += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      else accY += e.deltaY
      if (!raf) raf = requestAnimationFrame(flush)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const plotWidth = Math.max(0, width - PLOT_LEFT)
  const durations = [...takes.map((t) => t.duration), ...(instTake ? [instTake.duration] : [])]
  const trackMax = durations.length > 0 ? Math.max(...durations) : 0
  const validEnds = regions.map((r) => r.end).filter((v) => Number.isFinite(v))
  const maxDuration = trackMax > 0 ? trackMax : Math.max(...validEnds, 1)
  const pxPerSec = plotWidth > 0 ? (plotWidth / maxDuration) * zoomX : 0
  const timelineWidth = maxDuration * pxPerSec
  const bound = songLength > 0 ? songLength : maxDuration
  liveRef.current = { pxPerSec, bound, onRegionUpdate, onRegionCreate, setCreateRange }

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

  const regionMarks = useMemo(() => {
    const out: { x: number; color: string }[] = []
    regions.forEach((r, i) => {
      if (!Number.isFinite(r.start) || !Number.isFinite(r.end)) return
      const c = colorFor(i)
      out.push({ x: r.start * pxPerSec, color: c }, { x: r.end * pxPerSec, color: c })
    })
    return out
  }, [regions, pxPerSec])

  // 펼친 트랙의 구간별 슬라이스 결과 미리보기(config 적용). 무음 구간은 slice=null(스킵).
  const expandedSlices = useMemo(() => {
    if (!expandedId) return null
    const t = takes.find((x) => x.id === expandedId)
    if (!t) return null
    return regions
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start && r.name.trim())
      .map(({ r, i }) => ({
        region: r,
        color: colorFor(i),
        slice: sliceRegion(t.audioBuffer, r.name, t.name, r.start, r.end, config)
      }))
  }, [expandedId, takes, regions, config])

  const ticks: number[] = []
  const step = niceStep(pxPerSec)
  for (let t = 0; t <= maxDuration; t += step) ticks.push(t)

  const subH = Math.max(24, Math.round(rowH * 0.6))

  // 보이는 창(plot-local css px) — 모든 트랙이 같은 스크롤/뷰포트를 공유하므로 한 번만 계산.
  // 뷰포트 폭 = width(정상 측정값). plot은 content x=PLOT_LEFT에서 시작하므로 그만큼 뺌.
  const viewStart = scrollLeft - PLOT_LEFT
  const viewEnd = scrollLeft + width - PLOT_LEFT

  return (
    <div className="waveform" ref={ref}>
      <div className="waveform__header">
        <h2>Waveform</h2>
        {instTake && <span className="waveform__time">{secToMMSS(currentTime)}</span>}
        {(takes.length > 0 || instTake) && (
          <div className="waveform__zoom">
            <label className="waveform__zoom-ctl" title="Zoom X">
              <IconArrowsHorizontal size={16} stroke={2} />
              <input type="range" min={1} max={40} step={0.5} value={zoomX} onChange={(e) => setZoomX(Number(e.target.value))} />
            </label>
            <label className="waveform__zoom-ctl" title="Zoom Y">
              <IconArrowsVertical size={16} stroke={2} />
              <input type="range" min={24} max={320} step={4} value={rowH} onChange={(e) => setRowH(Number(e.target.value))} />
            </label>
          </div>
        )}
      </div>
      {takes.length === 0 && !instTake ? (
        <p className="waveform__empty">Upload tracks to see waveforms.</p>
      ) : (
        <div className="waveform__scroll" onScroll={onScroll}>
          {pxPerSec > 0 && (
            <div className="waveform__rulers">
              <div className="waveform__ruler-strip">
                <div className="waveform__ruler-gutter" />
                <div className="waveform__regionbar" style={{ width: timelineWidth }} onMouseDown={beginCreate}>
                  {createRange && (
                    <div
                      className="waveform__region-preview"
                      style={{ left: createRange.s * pxPerSec, width: Math.max(1, (createRange.e - createRange.s) * pxPerSec) }}
                    />
                  )}
                  {regions.map((r, i) => {
                    if (!Number.isFinite(r.start) || !Number.isFinite(r.end)) return null
                    const c = colorFor(i)
                    return (
                      <div
                        key={r.id}
                        className="waveform__region"
                        style={{ left: r.start * pxPerSec, width: Math.max(2, (r.end - r.start) * pxPerSec), borderLeftColor: c, backgroundColor: `${c}22`, color: c }}
                        title={`${r.name} (drag to adjust)`}
                        onMouseDown={(e) => beginDrag(e, r, 'move')}
                      >
                        <span className="waveform__region-handle waveform__region-handle--l" style={{ borderLeftColor: c }} onMouseDown={(e) => beginDrag(e, r, 'start')} />
                        <span className="waveform__region-name">{r.name}</span>
                        <span className="waveform__region-handle waveform__region-handle--r" style={{ borderRightColor: c }} onMouseDown={(e) => beginDrag(e, r, 'end')} />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="waveform__ruler-strip">
                <div className="waveform__ruler-gutter" />
                <div className="waveform__ticks" style={{ width: timelineWidth }}>
                  {ticks.map((t) => (
                    <span key={t} style={{ left: t * pxPerSec }}>
                      {secToMMSS(t)}
                    </span>
                  ))}
                </div>
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
              <div className="waveform__playhead" style={{ left: PLOT_LEFT + currentTime * pxPerSec }} />
            )}
            {instTake && (
              <div className="waveform__row waveform__row--inst">
                <div className="waveform__lanehead" onClick={(e) => e.stopPropagation()}>
                  <div className="waveform__lanehead-top">
                    <button className="waveform__lane-play" onClick={onInstToggle} aria-label="Play/Pause">
                      {instPlaying ? <IconPlayerPauseFilled size={14} /> : <IconPlayerPlayFilled size={14} />}
                    </button>
                    <button className="waveform__lane-stop" onClick={onInstStop} aria-label="Stop">
                      <IconPlayerStopFilled size={12} />
                    </button>
                    <span className="waveform__lane-name" title={instTake.name}>
                      INST · {instTake.name}
                    </span>
                    <button className="waveform__lane-del" onClick={onInstRemove} aria-label="Remove">
                      <IconTrash size={14} />
                    </button>
                  </div>
                  <div className="waveform__lane-meta">
                    {secToMMSS(instTake.duration)} · {Math.round(instTake.sampleRate / 100) / 10}kHz · {instTake.numChannels}ch
                  </div>
                </div>
                <div className="waveform__plot" style={{ width: instTake.duration * pxPerSec, height: rowH }}>
                  {pxPerSec > 0 && (
                    <TrackWaveform buffer={instTake.audioBuffer} width={instTake.duration * pxPerSec} height={rowH} marks={regionMarks} color="#4a9d6a" viewStart={viewStart} viewEnd={viewEnd} />
                  )}
                </div>
              </div>
            )}
            {takes.map((t) => (
              <Fragment key={t.id}>
                <div className="waveform__row">
                  <div className="waveform__lanehead" onClick={(e) => e.stopPropagation()}>
                    <div className="waveform__lanehead-top">
                      <button
                        className="waveform__lane-expand"
                        onClick={() => setExpandedId((id) => (id === t.id ? null : t.id))}
                        aria-label="Toggle split preview"
                      >
                        <IconChevronRight size={14} style={{ transform: expandedId === t.id ? 'rotate(90deg)' : 'none' }} />
                      </button>
                      <span className="waveform__lane-name" title={t.name}>
                        {t.name}
                      </span>
                      <button className="waveform__lane-del" onClick={() => onTakeRemove(t.id)} aria-label="Remove">
                        <IconTrash size={14} />
                      </button>
                    </div>
                    <div className="waveform__lane-meta">
                      {secToMMSS(t.duration)} · {Math.round(t.sampleRate / 100) / 10}kHz · {t.numChannels}ch
                    </div>
                  </div>
                  <div className="waveform__plot" style={{ width: t.duration * pxPerSec, height: rowH }}>
                    {pxPerSec > 0 && <TrackWaveform buffer={t.audioBuffer} width={t.duration * pxPerSec} height={rowH} marks={regionMarks} viewStart={viewStart} viewEnd={viewEnd} />}
                  </div>
                </div>

                {expandedId === t.id &&
                  expandedSlices &&
                  expandedSlices.map(({ region, color, slice }) => {
                    const dur = slice ? slice.length / slice.sampleRate : 0
                    return (
                      <div className="waveform__row waveform__row--sub" key={region.id}>
                        <div className="waveform__lanehead waveform__lanehead--sub" onClick={(e) => e.stopPropagation()}>
                          <span className="waveform__lane-name" style={{ color }}>
                            {region.name || '(unnamed)'}
                          </span>
                          <span className="waveform__lane-meta">
                            {slice ? `0:00 – ${secToMMSS(dur)}` : 'silent · skipped'}
                          </span>
                        </div>
                        <div className="waveform__plot" style={{ width: (dur || region.end - region.start) * pxPerSec, height: subH }}>
                          {slice && pxPerSec > 0 && (
                            <TrackWaveform
                              buffer={fakeBuffer(slice.channelData, slice.length, slice.sampleRate)}
                              width={dur * pxPerSec}
                              height={subH}
                              marks={[]}
                              color={color}
                              threshold={config.rmsThreshold}
                              viewStart={viewStart}
                              viewEnd={viewEnd}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WaveformView
