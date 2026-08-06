import { useState, useEffect } from 'react'
import Logo from './components/Logo'
import RegionForm from './components/RegionForm'
import TakeUpload from './components/TakeUpload'
import WaveformView from './components/WaveformView'
import RenderPanel from './components/RenderPanel'
import { Region, TakeFile, RenderConfig } from './types'
import { decodeWavFile, isWavFile } from './audio/decode'
import { buildProjectJSON, parseProject, loadProjectAudio } from './project'
import { usePlayback } from './hooks/usePlayback'

function App(): React.JSX.Element {
  // 구간 목록 = App이 소유(상태 끌어올리기). 다음 이슈(파형/렌더)에서도 이 목록을 공유한다.
  const [regions, setRegions] = useState<Region[]>([])
  // 업로드한 트랙 목록도 App이 소유 — 파형/슬라이스 이슈에서 공유.
  const [takes, setTakes] = useState<TakeFile[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // Render(캘리브레이션 노브). 다음 렌더 이슈에서 실제 파일 생성에 사용.
  const [config, setConfig] = useState<RenderConfig>({ rmsThreshold: 0.02, minActiveMs: 120, tailSec: 2 })
  // 인스트(반주) 레퍼런스 트랙 — takes(슬라이스 대상)와 분리. 재생·구간 잡기용.
  const [instTake, setInstTake] = useState<TakeFile | null>(null)
  const [busy, setBusy] = useState(false) // 프로젝트 로딩 중(중복 열기/저장 방지)
  const pb = usePlayback()

  const addInst = async (files: File[]): Promise<void> => {
    const wav = files.filter(isWavFile)[0]
    if (!wav) return
    try {
      const t = await decodeWavFile(wav)
      t.path = window.api.getPathForFile(wav) || undefined // 프로젝트 저장/재로드용 원본 경로
      setInstTake(t)
    } catch (e) {
      setLoadError(`Inst: ${(e as Error).message}`)
    }
  }
  const removeInst = (): void => {
    pb.stop()
    setInstTake(null)
  }

  // 고른/떨군 파일들을 디코드해 목록에 추가.
  // 순차 처리 + 하나 끝날 때마다 즉시 추가 — 폴더처럼 많아도 진행이 화면에 바로 보이게.
  // 비-wav는 거르고, 파일별 실패는 모아서 표시(한 파일 실패가 전체를 막지 않게).
  const addTakes = async (files: File[]): Promise<void> => {
    setLoadError(null)
    const wavs = files.filter(isWavFile)
    if (files.length > 0 && wavs.length === 0) {
      setLoadError('No WAV files')
      return
    }
    setProgress({ done: 0, total: wavs.length })
    const errs: string[] = []
    // 이미 로드된 트랙 이름 모음 — 같은 파일 재업로드 시 스킵(디코드 낭비도 막음).
    const seen = new Set(takes.map((t) => t.name))
    let skipped = 0
    for (let i = 0; i < wavs.length; i++) {
      const nameKey = wavs[i].name.replace(/\.[^.]+$/, '') // take.name과 같은 규칙(확장자 제거)
      if (seen.has(nameKey)) {
        skipped++
        setProgress({ done: i + 1, total: wavs.length })
        continue
      }
      try {
        const take = await decodeWavFile(wavs[i])
        take.path = window.api.getPathForFile(wavs[i]) || undefined // 프로젝트 저장/재로드용 원본 경로
        seen.add(nameKey)
        // 넣는 순간 최신 목록과 한 번 더 대조 — 동시 업로드로 같은 이름이 겹쳐 들어오는 것 차단.
        setTakes((ts) => (ts.some((t) => t.name === take.name) ? ts : [...ts, take]))
      } catch (e) {
        errs.push(`${wavs[i].name}: ${(e as Error).message}`)
      }
      setProgress({ done: i + 1, total: wavs.length })
    }
    setProgress(null)
    if (skipped > 0) errs.unshift(`${skipped} already loaded, skipped`)
    if (errs.length > 0) setLoadError(errs.join(' / '))
  }

  const removeTake = (id: string): void => setTakes((ts) => ts.filter((t) => t.id !== id))

  // 곡 구간은 이어붙으므로, 새 구간 시작 = 직전 구간 끝(없으면 0). 끝도 같은 값에서 시작해 유저가 늘림.
  const addRegion = (): void =>
    setRegions((rs) => {
      const prevEnd = rs.length > 0 ? rs[rs.length - 1].end : 0
      return [...rs, { id: crypto.randomUUID(), name: '', start: prevEnd, end: prevEnd }]
    })

  // id로 해당 구간만 찾아 patch 병합. 나머지는 그대로. 새 배열로 교체(불변성).
  const updateRegion = (id: string, patch: Partial<Region>): void =>
    setRegions((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRegion = (id: string): void => setRegions((rs) => rs.filter((r) => r.id !== id))

  // 빈 타임라인 드래그로 새 구간 생성(이름은 폼에서 입력).
  const addRegionAt = (start: number, end: number): void =>
    setRegions((rs) => [...rs, { id: crypto.randomUUID(), name: '', start, end }])

  const hasWork = regions.length > 0 || takes.length > 0 || instTake !== null

  // 프로젝트 저장 — 구간/설정/트랙 경로를 .tslicer로. 경로 없는 트랙은 제외(경고).
  const saveProject = async (): Promise<void> => {
    const { json, skipped } = buildProjectJSON(config, regions, instTake, takes)
    const path = await window.api.saveProject(json)
    setLoadError(
      path && skipped.length > 0
        ? `저장됨 — 경로 없는 트랙 ${skipped.length}개 제외: ${skipped.join(', ')}`
        : null
    )
  }

  // 프로젝트 열기 — 구간/설정 복원 + 경로에서 트랙 재로드. 없는 파일은 경고.
  const openProject = async (): Promise<void> => {
    if (busy) return
    const r = await window.api.openProject()
    if (!r) return
    setBusy(true)
    try {
      const p = parseProject(r.json)
      const { inst, takes: loaded, missing } = await loadProjectAudio(p)
      pb.stop()
      setRegions(p.regions)
      setConfig(p.config)
      setInstTake(inst)
      setTakes(loaded)
      setLoadError(missing.length > 0 ? `불러오지 못한 트랙(이동/삭제): ${missing.join(', ')}` : null)
    } catch (e) {
      setLoadError(`프로젝트 열기 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  // 스페이스바 = 인스트 재생/일시정지 (입력칸 포커스 중엔 무시).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space' || !instTake) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      e.preventDefault()
      pb.toggle(instTake.audioBuffer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [instTake, pb])

  return (
    <div className="app">
      <div className="app__top">
        <Logo />
        <div className="app__actions">
          <button className="app__btn" onClick={openProject} disabled={busy}>
            {busy ? 'Opening…' : 'Open'}
          </button>
          <button
            className="app__btn app__btn--primary"
            onClick={saveProject}
            disabled={!hasWork || busy}
          >
            Save
          </button>
        </div>
      </div>
      <TakeUpload onFiles={addTakes} onInstFiles={addInst} error={loadError} progress={progress} />
      <RegionForm
        regions={regions}
        onAdd={addRegion}
        onUpdate={updateRegion}
        onRemove={removeRegion}
        canEdit={instTake !== null}
        songLength={instTake?.duration ?? 0}
      />
      <WaveformView
        regions={regions}
        takes={takes}
        instTake={instTake}
        currentTime={pb.currentTime}
        onSeek={(sec) => pb.seek(sec, instTake?.audioBuffer)}
        onRegionUpdate={updateRegion}
        onRegionCreate={addRegionAt}
        songLength={instTake?.duration ?? 0}
        onTakeRemove={removeTake}
        instPlaying={pb.isPlaying}
        onInstToggle={() => instTake && pb.toggle(instTake.audioBuffer)}
        onInstStop={() => pb.stop()}
        onInstRemove={removeInst}
        config={config}
      />
      <RenderPanel regions={regions} takes={takes} config={config} onConfigChange={setConfig} />
    </div>
  )
}

export default App
