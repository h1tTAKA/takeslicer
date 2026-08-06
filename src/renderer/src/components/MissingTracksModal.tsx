import { MissingRef } from '../project'

interface Props {
  missing: MissingRef[]
  onReconnect: (ref: MissingRef, file: File) => void
  onClose: () => void
}

// 프로젝트 로드 시 경로 못 찾은 트랙 목록 + 파일 재지정(Locate).
// Locate는 <input type=file>로 WAV를 골라 그 트랙 슬롯에 다시 연결한다.
function MissingTracksModal({ missing, onReconnect, onClose }: Props): React.JSX.Element {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">파일을 찾지 못한 트랙</h2>
        <p className="modal__desc">
          경로가 바뀌었거나 삭제된 트랙입니다. 각 트랙에 파일을 다시 지정해 연결하세요.
        </p>
        <ul className="modal__list">
          {missing.map((m, i) => (
            <li key={`${m.path}-${i}`} className="modal__row">
              <div className="modal__info">
                <span className="modal__name">
                  {m.role === 'inst' ? 'INST · ' : ''}
                  {m.name}
                </span>
                <span className="modal__path" title={m.path}>
                  {m.path}
                </span>
              </div>
              <label className="modal__locate">
                Locate…
                <input
                  type="file"
                  accept=".wav,audio/wav,audio/x-wav"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onReconnect(m, f)
                    e.target.value = '' // 같은 파일 다시 고를 수 있게 리셋
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="modal__actions">
          <button className="app__btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default MissingTracksModal
