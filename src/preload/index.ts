import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface RenderFile {
  dir: string
  name: string
  bytes: Uint8Array
}

// renderer에 노출하는 통로. invoke로 main에 요청하고 결과를 Promise로 받음.
const api = {
  pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('pick-directory'),
  renderFiles: (outDir: string, files: RenderFile[]): Promise<{ written: number }> =>
    ipcRenderer.invoke('render-files', { outDir, files }),
  saveZip: (bytes: Uint8Array): Promise<string | null> => ipcRenderer.invoke('save-zip', bytes),
  openPath: (p: string): Promise<void> => ipcRenderer.invoke('open-path', p),
  // 업로드/드롭한 File의 실제 디스크 경로(프로젝트 저장/재로드용). 디스크 파일 아니면 ''.
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  saveProject: (json: string): Promise<string | null> => ipcRenderer.invoke('save-project', json),
  openProject: (): Promise<{ path: string; json: string } | null> => ipcRenderer.invoke('open-project'),
  readFile: (p: string): Promise<Uint8Array | null> => ipcRenderer.invoke('read-file', p),
  // 미저장 변경 여부를 main에 알림(닫기 가로채기 판단).
  setDirty: (v: boolean): void => ipcRenderer.send('set-dirty', v),
  // main이 닫기를 가로채 확인 요청할 때 콜백(중복 등록 방지 위해 기존 리스너 제거).
  onConfirmClose: (cb: () => void): void => {
    ipcRenderer.removeAllListeners('confirm-close')
    ipcRenderer.on('confirm-close', () => cb())
  },
  // 확인 후 실제 종료.
  quit: (): void => ipcRenderer.send('do-quit')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
