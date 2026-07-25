// 곡의 한 구간(인트로/벌스A/싸비...). 유저가 직접 입력한다.
export interface Region {
  id: string // 고유 식별 — 리스트 key + 삭제/수정 대상 지정용
  name: string // "싸비" 등. 나중에 폴더/파일명 prefix로 사용
  start: number // 시작 시각(초)
  end: number // 끝 시각(초)
}

// 업로드한 녹음 트랙 1개(디코드 완료 상태).
export interface TakeFile {
  id: string // 고유 식별 — 리스트 key + 삭제용
  name: string // 원본 파일명(확장자 제외) — 슬라이스 네이밍에 사용
  audioBuffer: AudioBuffer // 디코드된 소리 데이터(채널별 샘플)
  sampleRate: number // 원본 샘플레이트(Hz)
  numChannels: number // 채널 수(모노 1 / 스테레오 2)
  duration: number // 길이(초)
}
