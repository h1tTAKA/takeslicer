import { useState, DragEvent, ChangeEvent } from 'react'
import { IconFileMusic, IconFolder, IconMusic } from '@tabler/icons-react'

interface Props {
  onFiles: (files: File[]) => void // 고른/떨군 파일들을 부모(App)로 올림 — 디코드는 App이
  onInstFiles: (files: File[]) => void
  error: string | null
  progress: { done: number; total: number } | null
}

// 업로드 입구(파일/폴더/인스트 선택 + 드래그드롭)만 담당. 로드된 트랙 목록·재생은 파형 레인(WaveformView)에 통합.
function TakeUpload({ onFiles, onInstFiles, error, progress }: Props): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)

  // input에서 고른 파일 → 부모로. value 초기화해 같은 파일 재선택도 먹히게.
  const handleInput = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) onFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setDragOver(false)
    onFiles(Array.from(e.dataTransfer.files))
  }

  const handleInstInput = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) onInstFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  return (
    <div className="take-upload">
      <div className="take-upload__header">
        <h2>녹음 트랙</h2>
        <div className="take-upload__buttons">
          <label className="take-upload__btn">
            <IconFileMusic size={16} stroke={2} />
            파일 선택
            <input type="file" accept=".wav,audio/wav" multiple hidden onChange={handleInput} />
          </label>
          <label className="take-upload__btn">
            <IconFolder size={16} stroke={2} />
            폴더 선택
            {/* webkitdirectory는 React 표준 타입에 없어 spread+as any로 부여 (폴더 통째 선택) */}
            <input
              type="file"
              hidden
              onChange={handleInput}
              {...({ webkitdirectory: '' } as unknown as Record<string, string>)}
            />
          </label>
          <label className="take-upload__btn">
            <IconMusic size={16} stroke={2} />
            인스트
            <input type="file" accept=".wav,audio/wav" hidden onChange={handleInstInput} />
          </label>
        </div>
      </div>

      <div
        className={dragOver ? 'take-upload__drop take-upload__drop--over' : 'take-upload__drop'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        여기로 WAV 파일을 드래그하세요
      </div>

      {progress && (
        <div className="take-upload__progress">
          <div className="take-upload__progress-info">
            <span>처리 중…</span>
            <span>
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="take-upload__progress-bar">
            <div
              className="take-upload__progress-fill"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="take-upload__error">{error}</p>}
    </div>
  )
}

export default TakeUpload
