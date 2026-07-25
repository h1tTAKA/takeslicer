// WAV 헤더에서 원본 샘플레이트/채널 수를 읽는다.
// 왜 필요? decodeAudioData는 컨텍스트 레이트로 리샘플링하므로, 디코드 "전에" 원본 레이트를 알아야
// 그 레이트의 OfflineAudioContext를 만들어 리샘플링 없이 디코드할 수 있다.
//
// WAV 구조: [RIFF][size][WAVE] 뒤로 청크들. 각 청크 = [4바이트 태그][4바이트 크기][데이터].
// 'fmt ' 청크 데이터: audioFormat(2) numChannels(2) sampleRate(4) ...

export interface WavHeaderInfo {
  sampleRate: number
  numChannels: number
}

function readTag(view: DataView, off: number): string {
  return String.fromCharCode(
    view.getUint8(off),
    view.getUint8(off + 1),
    view.getUint8(off + 2),
    view.getUint8(off + 3)
  )
}

export function parseWavHeader(buf: ArrayBuffer): WavHeaderInfo {
  const view = new DataView(buf)
  if (view.byteLength < 12) throw new Error('WAV 파일이 너무 짧습니다')
  if (readTag(view, 0) !== 'RIFF' || readTag(view, 8) !== 'WAVE') {
    throw new Error('WAV 형식이 아닙니다')
  }
  let offset = 12 // 첫 청크 시작
  while (offset + 8 <= view.byteLength) {
    const tag = readTag(view, offset)
    const size = view.getUint32(offset + 4, true) // little-endian
    const data = offset + 8
    if (tag === 'fmt ') {
      const numChannels = view.getUint16(data + 2, true)
      const sampleRate = view.getUint32(data + 4, true)
      return { numChannels, sampleRate }
    }
    // 청크는 2바이트 정렬 — 홀수 크기면 패딩 1바이트
    offset = data + size + (size % 2)
  }
  throw new Error('fmt 청크를 찾지 못했습니다')
}

/** self-check: 최소 WAV 헤더를 만들어 파싱 검증. 로직 깨지면 throw. */
export function _assertWavHeader(): void {
  // 44바이트 표준 WAV 헤더(스테레오 48000Hz) 구성
  const b = new ArrayBuffer(44)
  const v = new DataView(b)
  const put = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  put(0, 'RIFF')
  v.setUint32(4, 36, true)
  put(8, 'WAVE')
  put(12, 'fmt ')
  v.setUint32(16, 16, true) // fmt size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 2, true) // numChannels
  v.setUint32(24, 48000, true) // sampleRate
  put(36, 'data')
  v.setUint32(40, 0, true)
  const info = parseWavHeader(b)
  if (info.sampleRate !== 48000) throw new Error(`wavHeader self-check: sampleRate ${info.sampleRate} !== 48000`)
  if (info.numChannels !== 2) throw new Error(`wavHeader self-check: numChannels ${info.numChannels} !== 2`)
}
