import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Region } from '../types'
import { secToMMSS, mmssToSec } from '../utils/time'
import { validateRegion } from '../utils/region'

interface Props {
  regions: Region[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Region>) => void
  onRemove: (id: string) => void
  canEdit: boolean // 인스트 올린 뒤에만 구간 설정 가능
  songLength: number // 노래 길이(인스트) — 시간 상한
}

// 구간 목록을 화면에 그리고, 추가/입력/삭제 요청을 부모(App)로 올린다.
// regions state는 App이 소유 — 여기선 값(regions)과 바꾸는 함수(onAdd/onUpdate/onRemove)를 prop으로 받는다.
function RegionForm({
  regions,
  onAdd,
  onUpdate,
  onRemove,
  canEdit,
  songLength
}: Props): React.JSX.Element {
  // 시간 입력 → 초 파싱 후 [0, 노래길이]로 클램프. 입력칸 표시도 클램프값으로 동기화.
  const commitTime = (id: string, key: 'start' | 'end', input: HTMLInputElement): void => {
    const v = mmssToSec(input.value)
    if (Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(v, songLength))
      input.value = secToMMSS(clamped) // uncontrolled 입력칸 표시 갱신
      onUpdate(id, { [key]: clamped })
    } else {
      onUpdate(id, { [key]: v }) // NaN은 검증이 잡게 그대로
    }
  }

  return (
    <div className="region-form">
      <div className="region-form__header">
        <h2>Sections</h2>
        <button className="region-form__add" onClick={onAdd} disabled={!canEdit}>
          <IconPlus size={16} stroke={2} />
          Add section
        </button>
      </div>

      {!canEdit ? (
        <p className="region-form__empty">Load an instrumental first to set up sections.</p>
      ) : regions.length === 0 ? (
        <p className="region-form__empty">Add sections to mark the song parts.</p>
      ) : (
        <ul className="region-list">
          {regions.map((r) => {
            const errs = validateRegion(r)
            return (
              <li key={r.id} className="region-item">
                <div className={errs.length ? 'region-row region-row--invalid' : 'region-row'}>
                  <input
                    className="region-row__name"
                    placeholder="Name (e.g. Chorus)"
                    value={r.name}
                    onChange={(e) => onUpdate(r.id, { name: e.target.value })}
                  />
                  {/* 시간 입력은 uncontrolled(defaultValue+onBlur): 타이핑 중간값("1:")이 즉시 초로
                      변환돼 화면과 싸우는 걸 피한다. 포커스가 빠질 때만 초로 파싱해 저장.
                      ponytail: 프로그램이 값을 바꿔줄 일 없어 uncontrolled로 충분. 필요 시 controlled+draft로 승급. */}
                  {/* key를 값과 묶음: 드래그 등 외부 변경 시 입력칸을 새로 그려 defaultValue 갱신.
                      타이핑 중엔 값이 안 바뀌어(onBlur에만 커밋) 리마운트 없음 → 입력 안 끊김. */}
                  <input
                    key={`s-${secToMMSS(r.start)}`}
                    className="region-row__time"
                    placeholder="0:00"
                    defaultValue={secToMMSS(r.start)}
                    onBlur={(e) => commitTime(r.id, 'start', e.target)}
                  />
                  <span>~</span>
                  <input
                    key={`e-${secToMMSS(r.end)}`}
                    className="region-row__time"
                    placeholder="0:00"
                    defaultValue={secToMMSS(r.end)}
                    onBlur={(e) => commitTime(r.id, 'end', e.target)}
                  />
                  <button className="region-row__del" onClick={() => onRemove(r.id)} aria-label="Delete">
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
