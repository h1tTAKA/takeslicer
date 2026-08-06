interface Props {
  onSave: () => void // 저장하고 닫기
  onDiscard: () => void // 그냥 닫기
  onCancel: () => void // 취소(닫기 중단)
}

// 미저장 변경이 있을 때 창을 닫으려 하면 뜨는 확인 모달.
function CloseConfirmModal({ onSave, onDiscard, onCancel }: Props): React.JSX.Element {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">저장하지 않은 변경사항</h2>
        <p className="modal__desc">변경사항이 있습니다. 저장하고 닫을까요?</p>
        <div className="modal__actions modal__actions--spread">
          <button className="app__btn" onClick={onDiscard}>
            저장 안 함
          </button>
          <div className="modal__actions">
            <button className="app__btn" onClick={onCancel}>
              취소
            </button>
            <button className="app__btn app__btn--primary" onClick={onSave}>
              저장하고 닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CloseConfirmModal
