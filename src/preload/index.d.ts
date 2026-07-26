import { ElectronAPI } from '@electron-toolkit/preload'

export interface RenderFile {
  dir: string // 구간 폴더명
  name: string // 파일명
  bytes: Uint8Array // wav 바이트
}

export interface TakeslicerAPI {
  pickDirectory(): Promise<string | null>
  renderFiles(outDir: string, files: RenderFile[]): Promise<{ written: number }>
  openPath(path: string): Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: TakeslicerAPI
  }
}
