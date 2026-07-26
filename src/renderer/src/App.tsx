import { useState } from 'react'
import RegionForm from './components/RegionForm'
import TakeUpload from './components/TakeUpload'
import { Region, TakeFile } from './types'
import { decodeWavFile, isWavFile } from './audio/decode'

function App(): React.JSX.Element {
  // 구간 목록 = App이 소유(상태 끌어올리기). 다음 이슈(파형/렌더)에서도 이 목록을 공유한다.
  const [regions, setRegions] = useState<Region[]>([])
  // 업로드한 트랙 목록도 App이 소유 — 파형/슬라이스 이슈에서 공유.
  const [takes, setTakes] = useState<TakeFile[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // 고른/떨군 파일들을 디코드해 목록에 추가.
  // 순차 처리 + 하나 끝날 때마다 즉시 추가 — 폴더처럼 많아도 진행이 화면에 바로 보이게.
  // 비-wav는 거르고, 파일별 실패는 모아서 표시(한 파일 실패가 전체를 막지 않게).
  const addTakes = async (files: File[]): Promise<void> => {
    setLoadError(null)
    const wavs = files.filter(isWavFile)
    if (files.length > 0 && wavs.length === 0) {
      setLoadError('WAV 파일이 없습니다')
      return
    }
    setProgress({ done: 0, total: wavs.length })
    const errs: string[] = []
    for (let i = 0; i < wavs.length; i++) {
      try {
        const take = await decodeWavFile(wavs[i])
        setTakes((ts) => [...ts, take]) // 하나 끝날 때마다 즉시 목록에 추가
      } catch (e) {
        errs.push(`${wavs[i].name}: ${(e as Error).message}`)
      }
      setProgress({ done: i + 1, total: wavs.length })
    }
    setProgress(null)
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

  return (
    <div className="app">
      <h1>takeslicer</h1>
      <RegionForm
        regions={regions}
        onAdd={addRegion}
        onUpdate={updateRegion}
        onRemove={removeRegion}
      />
      <TakeUpload
        takes={takes}
        onFiles={addTakes}
        onRemove={removeTake}
        error={loadError}
        progress={progress}
      />
    </div>
  )
}

export default App
