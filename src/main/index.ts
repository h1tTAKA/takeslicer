import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, resolve, sep } from 'path'
import { mkdir, writeFile, readFile, stat } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// 파일/폴더명 금지문자 치환 (renderer에서도 하지만 방어적으로 main에서도).
const BAD = /[/\\:*?"<>|]/g
const clean = (s: string): string => {
  const c = s.replace(BAD, '_').trim()
  return c.length > 0 ? c : 'untitled'
}

interface RenderFile {
  dir: string // 구간 폴더명
  name: string // 파일명
  bytes: Uint8Array // wav 바이트
}

// 렌더 IPC 핸들러 등록.
function registerRenderIpc(): void {
  // 유저가 실제로 고른 폴더만 기억 → open-path는 이 중에서만 허용(임의 경로 열기 방지).
  const pickedDirs = new Set<string>()

  // 출력 폴더 선택(네이티브 다이얼로그)
  ipcMain.handle('pick-directory', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (r.canceled || r.filePaths.length === 0) return null
    pickedDirs.add(resolve(r.filePaths[0]))
    return r.filePaths[0]
  })

  // wav 파일들을 구간별 폴더에 저장. 경로 traversal 방어.
  ipcMain.handle(
    'render-files',
    async (_e, payload: { outDir: string; files: RenderFile[] }): Promise<{ written: number }> => {
      const root = resolve(payload.outDir)
      const made = new Set<string>()
      let written = 0
      for (const f of payload.files) {
        const dir = join(root, clean(f.dir))
        const full = join(dir, clean(f.name))
        if (full !== root && !full.startsWith(root + sep)) throw new Error(`잘못된 경로: ${full}`)
        if (!made.has(dir)) {
          await mkdir(dir, { recursive: true })
          made.add(dir)
        }
        await writeFile(full, Buffer.from(f.bytes))
        written++
      }
      return { written }
    }
  )

  // zip 저장(저장 다이얼로그)
  ipcMain.handle('save-zip', async (_e, bytes: Uint8Array): Promise<string | null> => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'takeslicer.zip',
      filters: [{ name: 'Zip', extensions: ['zip'] }]
    })
    if (r.canceled || !r.filePath) return null
    await writeFile(r.filePath, Buffer.from(bytes))
    return r.filePath
  })

  // 저장 후 폴더 열기 — 유저가 고른 폴더만 허용(임의 경로 열기 차단).
  ipcMain.handle('open-path', async (_e, p: string) => {
    if (!pickedDirs.has(resolve(p))) throw new Error('허용되지 않은 경로')
    await shell.openPath(p)
  })

  // 프로젝트 저장(.tslicer JSON) — 저장 다이얼로그 후 파일 쓰기.
  ipcMain.handle('save-project', async (_e, json: string): Promise<string | null> => {
    const r = await dialog.showSaveDialog({
      defaultPath: 'takeSlicer-project.tslicer',
      filters: [{ name: 'takeSlicer project', extensions: ['tslicer'] }]
    })
    if (r.canceled || !r.filePath) return null
    await writeFile(r.filePath, json, 'utf8')
    return r.filePath
  })

  // 프로젝트 열기 — 파일 선택 후 JSON 문자열 반환.
  ipcMain.handle('open-project', async (): Promise<{ path: string; json: string } | null> => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'takeSlicer project', extensions: ['tslicer', 'json'] }]
    })
    if (r.canceled || r.filePaths.length === 0) return null
    const p = r.filePaths[0]
    try {
      return { path: p, json: await readFile(p, 'utf8') }
    } catch {
      return null // 읽기 실패(권한/삭제 등) — 렌더러로 reject 안 나가게
    }
  })

  // 프로젝트가 참조하는 원본 WAV 바이트 읽기(재디코드용).
  // .wav만 허용 — 임의 파일 읽기 축소(프로젝트 파일 공유 시 방어). 없/비파일/실패 null.
  ipcMain.handle('read-file', async (_e, p: string): Promise<Uint8Array | null> => {
    try {
      if (!/\.wav$/i.test(p)) return null
      if (!(await stat(p)).isFile()) return null
      return new Uint8Array(await readFile(p))
    } catch {
      return null
    }
  })
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    title: 'takeSlicer',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 앱 이름/식별자 + macOS dock 아이콘(개발 중에도 로고 보이게)
  app.setName('takeSlicer')
  electronApp.setAppUserModelId('com.neuradex.takeslicer')
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(icon)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerRenderIpc()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
