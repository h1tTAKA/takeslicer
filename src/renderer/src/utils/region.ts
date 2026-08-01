import { Region } from '../types'

// 구간 하나를 검사해 문제 목록을 돌려준다. 문제 없으면 빈 배열.
// 화면(RegionForm)은 이 목록이 비지 않은 행에 경고를 표시한다.
export function validateRegion(r: Region): string[] {
  const errs: string[] = []
  if (!r.name.trim()) errs.push('Enter a name')
  if (Number.isNaN(r.start) || Number.isNaN(r.end)) {
    errs.push('Invalid time (e.g. 0:32)')
    return errs // 시간이 숫자가 아니면 아래 크기 비교는 의미 없음
  }
  if (r.start < 0 || r.end < 0) errs.push('Time cannot be negative')
  if (r.end <= r.start) errs.push('End must be after start')
  return errs
}

/** self-check: 로직 깨지면 throw. node로 로직 검증용(앱 실행 시엔 호출 안 함). */
export function _assertValidateRegion(): void {
  const ok = (r: Region, expectLen: number, msg: string): void => {
    const n = validateRegion(r).length
    if (n !== expectLen) throw new Error(`region self-check 실패: ${msg} (errs=${n}, expect=${expectLen})`)
  }
  ok({ id: '1', name: '싸비', start: 0, end: 30 }, 0, '정상')
  ok({ id: '2', name: '', start: 0, end: 30 }, 1, '빈 이름')
  ok({ id: '3', name: '벌스', start: 30, end: 30 }, 1, '끝==시작')
  ok({ id: '4', name: '벌스', start: 40, end: 30 }, 1, '끝<시작')
  ok({ id: '5', name: '벌스', start: NaN, end: 30 }, 1, '시간 NaN')
  ok({ id: '6', name: '', start: -5, end: 30 }, 2, '빈 이름 + 음수')
}
