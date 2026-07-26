import { useEffect, useMemo, useState } from 'react'
import { Region, TakeFile, RenderConfig } from '../types'
import { detectRegion } from '../audio/detect'

interface Props {
  regions: Region[]
  takes: TakeFile[]
  config: RenderConfig
  onConfigChange: (cfg: RenderConfig) => void
}

// 렌더 설정 슬라이더(rms/minActive/tail) + 각 구간에 "소리 있는 트랙 수" 미리보기.
// 미리보기는 detect를 stride로 근사(빠름) + 150ms 디바운스(슬라이더 튈 때마다 재계산 방지).
function RenderPanel({ regions, takes, config, onConfigChange }: Props): React.JSX.Element {
  const set = (patch: Partial<RenderConfig>): void => onConfigChange({ ...config, ...patch })

  // 슬라이더는 즉시 반응(config), 무거운 미리보기 계산은 살짝 늦춰(debounced).
  const [debCfg, setDebCfg] = useState(config)
  useEffect(() => {
    const id = setTimeout(() => setDebCfg(config), 150)
    return () => clearTimeout(id)
  }, [config])

  const counts = useMemo(() => {
    const valid = regions.filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    return valid.map((r) => {
      let n = 0
      for (const t of takes) {
        const stride = Math.max(1, Math.floor(t.audioBuffer.sampleRate / 2000)) // 미리보기 근사
        if (detectRegion(t.audioBuffer, r.start, r.end, debCfg, stride).active) n++
      }
      return { id: r.id, name: r.name || '(이름없음)', n }
    })
  }, [regions, takes, debCfg])

  return (
    <div className="render-panel">
      <h2>렌더 설정</h2>
      <div className="render-panel__knobs">
        <label>
          <span>무음 임계값</span>
          <input
            type="range"
            min={0}
            max={0.2}
            step={0.002}
            value={config.rmsThreshold}
            onChange={(e) => set({ rmsThreshold: Number(e.target.value) })}
          />
          <span className="render-panel__val">{config.rmsThreshold.toFixed(3)}</span>
        </label>
        <label>
          <span>최소 소리길이</span>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={config.minActiveMs}
            onChange={(e) => set({ minActiveMs: Number(e.target.value) })}
          />
          <span className="render-panel__val">{config.minActiveMs}ms</span>
        </label>
        <label>
          <span>꼬리 여유</span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={config.tailSec}
            onChange={(e) => set({ tailSec: Number(e.target.value) })}
          />
          <span className="render-panel__val">{config.tailSec.toFixed(1)}s</span>
        </label>
      </div>

      {takes.length > 0 && counts.length > 0 && (
        <div className="render-panel__preview">
          <span className="render-panel__preview-title">이 설정으로 뽑힐 트랙</span>
          {counts.map((c) => (
            <span key={c.id} className="render-panel__chip">
              {c.name} <b>{c.n}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default RenderPanel
