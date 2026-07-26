// Float32 채널 샘플 → 16-bit PCM WAV 바이트(Uint8Array). 헤더 44바이트 + 인터리브드 샘플.
export function encodeWav(channelData: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channelData.length
  const numFrames = numChannels > 0 ? channelData[0].length : 0
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign

  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)
  const writeStr = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let off = 44
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let s = channelData[c][i]
      s = Math.max(-1, Math.min(1, s)) // 클리핑 방어
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true) // -1~1 → 16bit 정수
      off += 2
    }
  }
  return new Uint8Array(ab)
}

/** self-check: 작은 스테레오 샘플 인코드 후 헤더/크기 검증. */
export function _assertWav(): void {
  const left = new Float32Array([0, 1, -1])
  const right = new Float32Array([0.5, -0.5, 0])
  const bytes = encodeWav([left, right], 44100)
  const view = new DataView(bytes.buffer)
  const tag = (o: number): string =>
    String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3))
  const eq = (a: unknown, b: unknown, m: string): void => {
    if (a !== b) throw new Error(`wav self-check 실패: ${m} (${a} !== ${b})`)
  }
  eq(tag(0), 'RIFF', 'RIFF')
  eq(tag(8), 'WAVE', 'WAVE')
  eq(tag(12), 'fmt ', 'fmt ')
  eq(tag(36), 'data', 'data')
  eq(view.getUint16(22, true), 2, '채널 2')
  eq(view.getUint32(24, true), 44100, 'sampleRate')
  eq(view.getUint16(34, true), 16, 'bits 16')
  const dataSize = 3 * 2 * 2 // 3프레임 × 2채널 × 2바이트
  eq(view.getUint32(40, true), dataSize, 'data size')
  eq(bytes.length, 44 + dataSize, '총 길이')
  eq(view.getInt16(44, true), 0, '샘플[0] L=0')
  eq(view.getInt16(48, true), 0x7fff, '샘플[1] L=1.0 → 32767')
}
