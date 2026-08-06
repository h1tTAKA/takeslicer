import { TakeFile } from '../types'
import { parseWavHeader } from './wavHeader'

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

// 확장자/타입으로 wav만 골라낸다(폴더 선택 시 섞인 비-wav 걸러내기).
// macOS AppleDouble(`._원본이름`)만 제외 — 원본 파일마다 자동 생성되는 숨김 짝꿍이라 반드시 진짜 원본이 따로 있다.
// (`._` 패턴만 좁게 제외 → 엔지니어가 지은 정상 파일은 절대 안 걸림)
export function isWavFile(file: File): boolean {
  if (file.name.startsWith('._')) return false
  return /\.wav$/i.test(file.name) || file.type === 'audio/wav' || file.type === 'audio/x-wav'
}

// 공유 코어: 원시 바이트 → TakeFile. 원본 샘플레이트로 디코드해 리샘플링을 피한다.
async function decodeWav(buf: ArrayBuffer, name: string): Promise<TakeFile> {
  const { sampleRate, numChannels } = parseWavHeader(buf) // 디코드 전에 원본 레이트 확보

  // OfflineAudioContext를 원본 레이트로 만들면 decodeAudioData가 그 레이트로 디코드 → 리샘플링 없음.
  // length는 1이면 충분(디코드 자체는 컨텍스트 길이와 무관). 채널 0 방어로 최소 1.
  const octx = new OfflineAudioContext(Math.max(numChannels, 1), 1, sampleRate)

  // decodeAudioData는 넘긴 ArrayBuffer를 detach(소비)하므로 복사본(slice)을 준다.
  const audioBuffer = await octx.decodeAudioData(buf.slice(0))

  return {
    id: crypto.randomUUID(),
    name: stripExt(name),
    audioBuffer,
    sampleRate,
    numChannels: audioBuffer.numberOfChannels,
    duration: audioBuffer.duration
  }
}

// File → TakeFile (업로드).
export async function decodeWavFile(file: File): Promise<TakeFile> {
  return decodeWav(await file.arrayBuffer(), file.name)
}

// 원시 바이트 → TakeFile (프로젝트 재로드). path에 원본 경로를 기록해 다시 저장 가능하게.
export async function decodeWavBytes(bytes: ArrayBuffer, name: string, path?: string): Promise<TakeFile> {
  const take = await decodeWav(bytes, name)
  take.path = path
  return take
}
