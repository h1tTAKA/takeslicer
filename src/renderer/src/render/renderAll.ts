import { Region, TakeFile, RenderConfig } from '../types'
import { sliceRegion } from '../audio/slice'
import { encodeWav } from '../audio/wav'
import { buildFilename, sanitize } from '../audio/naming'

export interface RenderSummary {
  written: number
  regions: number
}

// 각 구간 × 각 트랙을 정밀 슬라이스(stride=1) → wav 인코드 → 구간 단위로 main에 저장 요청.
// 구간별로 만들고 저장하고 버려(메모리 바운드). onProgress(done, total)로 진행 알림.
export async function renderAll(
  outDir: string,
  regions: Region[],
  takes: TakeFile[],
  config: RenderConfig,
  onProgress?: (done: number, total: number) => void
): Promise<RenderSummary> {
  const valid = regions.filter(
    (r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start && r.name.trim()
  )
  const total = valid.length * takes.length
  let done = 0
  let written = 0

  for (const r of valid) {
    const files: { dir: string; name: string; bytes: Uint8Array }[] = []
    let nn = 0
    for (const t of takes) {
      const s = sliceRegion(t.audioBuffer, r.name, t.name, r.start, r.end, config)
      if (s) {
        nn++
        files.push({
          dir: sanitize(r.name),
          name: buildFilename(r.name, nn, t.name),
          bytes: encodeWav(s.channelData, s.sampleRate)
        })
      }
      done++
      onProgress?.(done, total)
    }
    if (files.length > 0) {
      const res = await window.api.renderFiles(outDir, files)
      written += res.written
    }
  }
  return { written, regions: valid.length }
}
