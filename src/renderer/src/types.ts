// 곡의 한 구간(인트로/벌스A/싸비...). 유저가 직접 입력한다.
export interface Region {
  id: string // 고유 식별 — 리스트 key + 삭제/수정 대상 지정용
  name: string // "싸비" 등. 나중에 폴더/파일명 prefix로 사용
  start: number // 시작 시각(초)
  end: number // 끝 시각(초)
}

// 렌더 설정(캘리브레이션 노브). masterplan §5.2
export interface RenderConfig {
  rmsThreshold: number // 선형 진폭 임계값(0~1). 이하면 무음 취급
  minActiveMs: number // 이 길이 이상 소리나야 "있음"(숨소리 튐 방지)
  tailSec: number // 파형 끝 뒤 꼬리 여유 + 경계 확장 판정 gap(초)
}

// 슬라이스 1개 결과(파일 쓰기 전). 0초부터 렌더된 채널 샘플.
export interface SliceResult {
  regionName: string
  takeName: string
  filename: string // 구간이름NN원본.wav
  channelData: Float32Array[] // 채널별 샘플(길이 = 0~renderEnd)
  sampleRate: number
  length: number // 총 샘플 수
}

// 업로드한 녹음 트랙 1개(디코드 완료 상태).
export interface TakeFile {
  id: string // 고유 식별 — 리스트 key + 삭제용
  name: string // 원본 파일명(확장자 제외) — 슬라이스 네이밍에 사용
  audioBuffer: AudioBuffer // 디코드된 소리 데이터(채널별 샘플)
  sampleRate: number // 원본 샘플레이트(Hz)
  numChannels: number // 채널 수(모노 1 / 스테레오 2)
  duration: number // 길이(초)
  path?: string // 원본 WAV 디스크 경로(프로젝트 저장/재로드용). 디스크 파일 아니면 없음
}
