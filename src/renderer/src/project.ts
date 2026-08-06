// 프로젝트 저장/불러오기 헬퍼. 오디오는 경로 참조만 담고(파일은 큼), 로드 시 경로에서 재디코드.
import { Region, RenderConfig, TakeFile } from './types'
import { decodeWavBytes } from './audio/decode'

const VERSION = 1

interface Ref {
  path: string // 원본 WAV 디스크 경로
  name: string // 표시/네이밍용 이름
}

export interface ProjectFile {
  v: number
  savedAt: string
  songLength: number // 참고용(로드 시엔 인스트에서 파생)
  config: RenderConfig
  regions: Region[]
  inst: Ref | null
  takes: Ref[]
}

// 현재 상태 → 프로젝트 JSON. 경로 없는(디스크 파일 아닌) 트랙은 저장 제외 → skipped로 알림.
export function buildProjectJSON(
  config: RenderConfig,
  regions: Region[],
  instTake: TakeFile | null,
  takes: TakeFile[]
): { json: string; skipped: string[] } {
  const skipped: string[] = []
  const ref = (t: TakeFile): Ref | null => {
    if (!t.path) {
      skipped.push(t.name)
      return null
    }
    return { path: t.path, name: t.name }
  }
  const inst = instTake ? ref(instTake) : null
  const takeRefs = takes.map(ref).filter((r): r is Ref => r !== null)
  const project: ProjectFile = {
    v: VERSION,
    savedAt: new Date().toISOString(),
    songLength: instTake?.duration ?? 0,
    config,
    regions,
    inst,
    takes: takeRefs
  }
  return { json: JSON.stringify(project, null, 2), skipped }
}

// JSON 파싱 + 검증. config 필드·트랙 ref 형태까지 확인(깨진 파일이 뒤에서 크래시 나지 않게).
export function parseProject(json: string): ProjectFile {
  const p = JSON.parse(json)
  const isRef = (x: unknown): boolean =>
    !!x &&
    typeof x === 'object' &&
    typeof (x as Ref).path === 'string' &&
    typeof (x as Ref).name === 'string'
  const c = p?.config
  const ok =
    p &&
    typeof p === 'object' &&
    c &&
    typeof c === 'object' &&
    typeof c.rmsThreshold === 'number' &&
    typeof c.minActiveMs === 'number' &&
    typeof c.tailSec === 'number' &&
    Array.isArray(p.regions) &&
    Array.isArray(p.takes) &&
    p.takes.every(isRef) &&
    (p.inst === null || isRef(p.inst))
  if (!ok) throw new Error('잘못된 프로젝트 파일')
  return p as ProjectFile
}

// 프로젝트의 경로들에서 오디오 재로드. 못 읽거나 디코드 실패한 트랙 이름은 missing으로.
export async function loadProjectAudio(
  p: ProjectFile
): Promise<{ inst: TakeFile | null; takes: TakeFile[]; missing: string[] }> {
  const missing: string[] = []
  const load = async (r: Ref): Promise<TakeFile | null> => {
    const bytes = await window.api.readFile(r.path)
    if (!bytes) {
      missing.push(r.name)
      return null
    }
    try {
      // IPC로 온 Uint8Array는 offset 0의 새 ArrayBuffer → 캐스트 안전.
      return await decodeWavBytes(bytes.buffer as ArrayBuffer, r.name, r.path)
    } catch {
      missing.push(r.name)
      return null
    }
  }
  const inst = p.inst ? await load(p.inst) : null
  const takes: TakeFile[] = []
  for (const r of p.takes) {
    const t = await load(r)
    if (t) takes.push(t)
  }
  return { inst, takes, missing }
}
