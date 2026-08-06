import { ElectronAPI } from '@electron-toolkit/preload'

export interface RenderFile {
  dir: string // 구간 폴더명
  name: string // 파일명
  bytes: Uint8Array // wav 바이트
}

export interface TakeslicerAPI {
  pickDirectory(): Promise<string | null>
  renderFiles(outDir: string, files: RenderFile[]): Promise<{ written: number }>
  saveZip(bytes: Uint8Array): Promise<string | null>
  openPath(path: string): Promise<void>
  getPathForFile(file: File): string
  saveProject(json: string): Promise<string | null>
  openProject(): Promise<{ path: string; json: string } | null>
  readFile(path: string): Promise<Uint8Array | null>
  setDirty(dirty: boolean): void
  onConfirmClose(cb: () => void): void
  quit(): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TakeslicerAPI
  }
}
