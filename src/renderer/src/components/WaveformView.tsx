import { useEffect, useMemo, useRef, useState } from 'react'
import { IconZoom } from '@tabler/icons-react'
import { Region, TakeFile } from '../types'
import { secToMMSS } from '../utils/time'
import TrackWaveform from './TrackWaveform'

const GUTTER = 110 // 트랙명 거터 폭(px)

// 시간 눈금 간격: 화면에 ~12개 이하로 떨어지게 고른다.
function niceStep(dur: number): number {
  for (const c of [5, 10, 15, 30, 60, 120, 300]) if (dur / c <= 12) return c
  return 600
}

interface Props {
  regions: Region[]
  takes: TakeFile[]
}

// 트랙들을 공유 시간축으로 스택하는 컨테이너. 모든 트랙이 같은 pxPerSec을 써야 경계선이 일직선으로 맞는다.
function WaveformView({ regions, takes }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [rowH, setRowH] = useState(40) // 세로(트랙 높이) px — 파형 크게/작게 보기

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
  const plotWidth = Math.max(0, width - GUTTER)
  const trackMax = takes.length > 0 ? Math.max(...takes.map((t) => t.duration)) : 0
  const validEnds = regions.map((r) => r.end).filter((v) => Number.isFinite(v))
  // 트랙 있으면 트랙 길이 기준, 없으면(파형 없음) 구간 끝 기준.
  const maxDuration = trackMax > 0 ? trackMax : Math.max(...validEnds, 1)
  const pxPerSec = plotWidth > 0 ? plotWidth / maxDuration : 0

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
        {takes.length > 0 && (
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
      {takes.length === 0 ? (
        <p className="waveform__empty">트랙을 업로드하면 파형이 여기 표시됩니다.</p>
      ) : (
        <>
          {pxPerSec > 0 && (
            <div className="waveform__rulers">
              <div className="waveform__regionbar" style={{ marginLeft: GUTTER, width: plotWidth }}>
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
                      title={r.name}
                    >
                      {r.name}
                    </div>
                  ))}
              </div>
              <div className="waveform__ticks" style={{ marginLeft: GUTTER, width: plotWidth }}>
                {ticks.map((t) => (
                  <span key={t} style={{ left: t * pxPerSec }}>
                    {secToMMSS(t)}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="waveform__rows">
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
