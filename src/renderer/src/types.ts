// 곡의 한 구간(인트로/벌스A/싸비...). 유저가 직접 입력한다.
export interface Region {
  id: string // 고유 식별 — 리스트 key + 삭제/수정 대상 지정용
  name: string // "싸비" 등. 나중에 폴더/파일명 prefix로 사용
  start: number // 시작 시각(초)
  end: number // 끝 시각(초)
}
