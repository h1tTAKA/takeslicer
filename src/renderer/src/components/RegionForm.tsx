import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Region } from '../types'
import { secToMMSS, mmssToSec } from '../utils/time'
import { validateRegion } from '../utils/region'

interface Props {
  regions: Region[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Region>) => void
  onRemove: (id: string) => void
}

// 구간 목록을 화면에 그리고, 추가/입력/삭제 요청을 부모(App)로 올린다.
// regions state는 App이 소유 — 여기선 값(regions)과 바꾸는 함수(onAdd/onUpdate/onRemove)를 prop으로 받는다.
function RegionForm({ regions, onAdd, onUpdate, onRemove }: Props): React.JSX.Element {
  return (
    <div className="region-form">
      <div className="region-form__header">
        <h2>구간 목록</h2>
        <button className="region-form__add" onClick={onAdd}>
          <IconPlus size={16} stroke={2} />
          구성 추가
        </button>
      </div>

      {regions.length === 0 ? (
        <p className="region-form__empty">구성을 추가해 곡 구간을 입력하세요.</p>
      ) : (
        <ul className="region-list">
          {regions.map((r) => {
            const errs = validateRegion(r)
            return (
              <li key={r.id} className="region-item">
                <div className={errs.length ? 'region-row region-row--invalid' : 'region-row'}>
                  <input
                    className="region-row__name"
                    placeholder="구간 이름 (예: 싸비)"
                    value={r.name}
                    onChange={(e) => onUpdate(r.id, { name: e.target.value })}
                  />
                  {/* 시간 입력은 uncontrolled(defaultValue+onBlur): 타이핑 중간값("1:")이 즉시 초로
                      변환돼 화면과 싸우는 걸 피한다. 포커스가 빠질 때만 초로 파싱해 저장.
                      ponytail: 프로그램이 값을 바꿔줄 일 없어 uncontrolled로 충분. 필요 시 controlled+draft로 승급. */}
                  <input
                    className="region-row__time"
                    placeholder="0:00"
                    defaultValue={secToMMSS(r.start)}
                    onBlur={(e) => onUpdate(r.id, { start: mmssToSec(e.target.value) })}
                  />
                  <span>~</span>
                  <input
                    className="region-row__time"
                    placeholder="0:00"
                    defaultValue={secToMMSS(r.end)}
                    onBlur={(e) => onUpdate(r.id, { end: mmssToSec(e.target.value) })}
                  />
                  <button className="region-row__del" onClick={() => onRemove(r.id)} aria-label="삭제">
                    <IconTrash size={16} stroke={2} />
                  </button>
                </div>
                {errs.length > 0 && <p className="region-row__error">{errs.join(' · ')}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default RegionForm
