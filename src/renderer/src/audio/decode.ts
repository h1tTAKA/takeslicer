import { TakeFile } from '../types'
import { parseWavHeader } from './wavHeader'

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

// File → TakeFile. 원본 샘플레이트로 디코드해 리샘플링을 피한다.
export async function decodeWavFile(file: File): Promise<TakeFile> {
  const buf = await file.arrayBuffer() // 파일 원시 바이트
  const { sampleRate, numChannels } = parseWavHeader(buf) // 디코드 전에 원본 레이트 확보

  // OfflineAudioContext를 원본 레이트로 만들면 decodeAudioData가 그 레이트로 디코드 → 리샘플링 없음.
  // length는 1이면 충분(디코드 자체는 컨텍스트 길이와 무관). 채널 0 방어로 최소 1.
  const octx = new OfflineAudioContext(Math.max(numChannels, 1), 1, sampleRate)

  // decodeAudioData는 넘긴 ArrayBuffer를 detach(소비)하므로 복사본(slice)을 준다.
  const audioBuffer = await octx.decodeAudioData(buf.slice(0))

  return {
    id: crypto.randomUUID(),
    name: stripExt(file.name),
    audioBuffer,
    sampleRate,
    numChannels: audioBuffer.numberOfChannels,
    duration: audioBuffer.duration
  }
}
