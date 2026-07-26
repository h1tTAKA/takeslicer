import JSZip from 'jszip'
import { Region, TakeFile, RenderConfig } from '../types'
import { sliceRegion } from '../audio/slice'
import { encodeWav } from '../audio/wav'
import { buildFilename, sanitize } from '../audio/naming'

export interface RenderSummary {
  written: number
  regions: number
  zipPath?: string | null
}

function validRegions(regions: Region[]): Region[] {
  return regions.filter(
    (r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start && r.name.trim()
  )
}

// 각 구간 × 각 트랙을 정밀 슬라이스(stride=1) → wav 인코드.
// zip=false: 구간 단위로 main에 저장 요청(메모리 바운드, 폴더 구조).
// zip=true: 전부 JSZip에 담아 zip 하나로 저장.
export async function renderAll(
  outDir: string | null,
  regions: Region[],
  takes: TakeFile[],
  config: RenderConfig,
  zip: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<RenderSummary> {
  const valid = validRegions(regions)
  const total = valid.length * takes.length
  let done = 0
  let written = 0
  const jszip = zip ? new JSZip() : null

  for (const r of valid) {
    const files: { dir: string; name: string; bytes: Uint8Array }[] = []
    let nn = 0
    for (const t of takes) {
      const s = sliceRegion(t.audioBuffer, r.name, t.name, r.start, r.end, config)
      if (s) {
        nn++
        const dir = sanitize(r.name)
        const name = buildFilename(r.name, nn, t.name)
        const bytes = encodeWav(s.channelData, s.sampleRate)
        if (jszip) jszip.file(`${dir}/${name}`, bytes)
        else files.push({ dir, name, bytes })
      }
      done++
      onProgress?.(done, total)
    }
    if (!jszip && files.length > 0 && outDir) {
      const res = await window.api.renderFiles(outDir, files)
      written += res.written
    } else {
      written += files.length // (jszip일 땐 아래에서 total 계산)
    }
  }

  if (jszip) {
    const content = await jszip.generateAsync({ type: 'uint8array' })
    const zipPath = await window.api.saveZip(content)
    // zip은 파일 수를 jszip 내부 개수로
    written = Object.keys(jszip.files).filter((k) => !jszip.files[k].dir).length
    return { written: zipPath ? written : 0, regions: valid.length, zipPath }
  }
  return { written, regions: valid.length }
}
