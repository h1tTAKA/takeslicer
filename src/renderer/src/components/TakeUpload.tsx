import { useState, DragEvent, ChangeEvent } from 'react'
import {
  IconTrash,
  IconFileMusic,
  IconFolder,
  IconMusic,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerStopFilled
} from '@tabler/icons-react'
import { TakeFile } from '../types'
import { secToMMSS } from '../utils/time'

interface Props {
  takes: TakeFile[]
  onFiles: (files: File[]) => void // 고른/떨군 파일들을 부모(App)로 올림 — 디코드는 App이
  onRemove: (id: string) => void
  error: string | null
  progress: { done: number; total: number } | null
  instTake: TakeFile | null
  onInstFiles: (files: File[]) => void
  onInstRemove: () => void
  instPlaying: boolean
  onInstToggle: () => void
  onInstStop: () => void
}

// 세 가지 입구(파일 선택 / 폴더 선택 / 드래그드롭)로 File들을 모아 App에 넘기고, 로드된 트랙 목록을 보여준다.
function TakeUpload({
  takes,
  onFiles,
  onRemove,
  error,
  progress,
  instTake,
  onInstFiles,
  onInstRemove,
  instPlaying,
  onInstToggle,
  onInstStop
}: Props): React.JSX.Element {
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

      {instTake && (
        <div className="take-upload__inst">
          <button className="take-upload__play" onClick={onInstToggle} aria-label="재생/일시정지">
            {instPlaying ? (
              <IconPlayerPauseFilled size={16} />
            ) : (
              <IconPlayerPlayFilled size={16} />
            )}
          </button>
          <button className="take-upload__stop" onClick={onInstStop} aria-label="정지(맨 처음으로)">
            <IconPlayerStopFilled size={14} />
          </button>
          <span className="take-upload__inst-tag">INST</span>
          <span className="take-row__name">{instTake.name}</span>
          <span className="take-row__meta">{secToMMSS(instTake.duration)}</span>
          <button className="take-row__del" onClick={onInstRemove} aria-label="인스트 제거">
            <IconTrash size={16} stroke={2} />
          </button>
        </div>
      )}

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

      {takes.length > 0 && (
        <>
          <p className="take-upload__count">로드된 트랙 ({takes.length})</p>
          <ul className="take-list">
            {takes.map((t) => (
              <li key={t.id} className="take-row">
                <span className="take-row__name">{t.name}</span>
                <span className="take-row__meta">{secToMMSS(t.duration)}</span>
                <span className="take-row__meta">{Math.round(t.sampleRate / 100) / 10}kHz</span>
                <span className="take-row__meta">{t.numChannels}ch</span>
                <button
                  className="take-row__del"
                  onClick={() => onRemove(t.id)}
                  aria-label="삭제"
                >
                  <IconTrash size={16} stroke={2} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default TakeUpload
