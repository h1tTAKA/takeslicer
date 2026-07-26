import { useEffect, useRef, useState } from 'react'
import { IconZoom } from '@tabler/icons-react'
import { Region, TakeFile } from '../types'
import TrackWaveform from './TrackWaveform'

const GUTTER = 110 // 트랙명 거터 폭(px)

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

  // 공유 시간축: 가장 긴 트랙(또는 구간 끝) 기준 1초=pxPerSec. 폭에 딱 맞춤.
  const plotWidth = Math.max(0, width - GUTTER)
  const maxDuration = Math.max(...takes.map((t) => t.duration), ...regions.map((r) => r.end), 1)
  const pxPerSec = plotWidth > 0 ? plotWidth / maxDuration : 0

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
        <div className="waveform__rows">
          {takes.map((t) => (
            <div key={t.id} className="waveform__row">
              <span className="waveform__label" title={t.name}>
                {t.name}
              </span>
              <div className="waveform__plot" style={{ width: t.duration * pxPerSec, height: rowH }}>
                {pxPerSec > 0 && (
                  <TrackWaveform buffer={t.audioBuffer} width={t.duration * pxPerSec} height={rowH} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WaveformView
