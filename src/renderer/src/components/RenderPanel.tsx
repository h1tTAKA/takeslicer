import { useEffect, useMemo, useState } from 'react'
import { IconFolder } from '@tabler/icons-react'
import { Region, TakeFile, RenderConfig } from '../types'
import { detectRegion } from '../audio/detect'
import { renderAll } from '../render/renderAll'

interface Props {
  regions: Region[]
  takes: TakeFile[]
  config: RenderConfig
  onConfigChange: (cfg: RenderConfig) => void
}

// Render 슬라이더(rms/minActive/tail) + 각 구간에 "소리 있는 트랙 수" 미리보기.
// 미리보기는 detect를 stride로 근사(빠름) + 150ms 디바운스(슬라이더 튈 때마다 재계산 방지).
function RenderPanel({ regions, takes, config, onConfigChange }: Props): React.JSX.Element {
  const set = (patch: Partial<RenderConfig>): void => onConfigChange({ ...config, ...patch })

  const [outDir, setOutDir] = useState<string | null>(null)
  const [zip, setZip] = useState(false)
  const [rendering, setRendering] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const pickFolder = async (): Promise<void> => {
    const dir = await window.api.pickDirectory()
    if (dir) setOutDir(dir)
  }

  const doRender = async (): Promise<void> => {
    if (!zip && !outDir) return
    setResult(null)
    // renderAll이 처리하는 실제 총 개수(유효 구간 × 트랙)로 진행바 초기화.
    const validCount = regions.filter(
      (r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start && r.name.trim()
    ).length
    setRendering({ done: 0, total: validCount * takes.length })
    try {
      const summary = await renderAll(outDir, regions, takes, config, zip, (done, total) =>
        setRendering({ done, total })
      )
      if (summary.written === 0) {
        setResult(
          zip && summary.zipPath === null
            ? 'Canceled'
            : 'Nothing to export (check sections/tracks/threshold)'
        )
      } else if (zip) {
        setResult(`${summary.written} files → ${summary.zipPath}`)
      } else {
        setResult(`${summary.written} files saved (${summary.regions} sections)`)
        if (outDir) await window.api.openPath(outDir)
      }
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`)
    } finally {
      setRendering(null)
    }
  }

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
      return { id: r.id, name: r.name || '(unnamed)', n }
    })
  }, [regions, takes, debCfg])

  return (
    <div className="render-panel">
      <h2>Render</h2>
      <div className="render-panel__knobs">
        <label>
          <span>Silence threshold</span>
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
          <span>Min length</span>
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
          <span>Tail</span>
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
          <span className="render-panel__preview-title">Will export</span>
          {counts.map((c) => (
            <span key={c.id} className="render-panel__chip">
              {c.name} <b>{c.n}</b>
            </span>
          ))}
        </div>
      )}

      <div className="render-panel__run">
        <button className="render-panel__folder" onClick={pickFolder} disabled={zip}>
          <IconFolder size={16} stroke={2} />
          Output
        </button>
        <span className="render-panel__path" title={outDir ?? ''}>
          {zip ? 'Save as zip' : (outDir ?? 'Choose a folder')}
        </span>
        <label className="render-panel__zip">
          <input type="checkbox" checked={zip} onChange={(e) => setZip(e.target.checked)} />
          zip
        </label>
        <button
          className="render-panel__go"
          onClick={doRender}
          disabled={(!zip && !outDir) || takes.length === 0 || rendering !== null}
        >
          {rendering ? `Rendering… ${rendering.done}/${rendering.total}` : 'Render'}
        </button>
      </div>
      {result && <p className="render-panel__result">{result}</p>}
    </div>
  )
}

export default RenderPanel
