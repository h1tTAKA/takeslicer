import { useState } from 'react'
import RegionForm from './components/RegionForm'
import { Region } from './types'

function App(): React.JSX.Element {
  // 구간 목록 = App이 소유(상태 끌어올리기). 다음 이슈(파형/렌더)에서도 이 목록을 공유한다.
  const [regions, setRegions] = useState<Region[]>([])

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
    </div>
  )
}

export default App
