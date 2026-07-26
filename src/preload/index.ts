import { contextBridge, ipcRenderer } from 'electron'
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
  openPath: (p: string): Promise<void> => ipcRenderer.invoke('open-path', p)
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
