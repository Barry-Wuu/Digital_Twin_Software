import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { onMounted } from 'vue'
import { release } from 'node:os'
import { join } from 'node:path'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let window = null;
const preload = join(__dirname, '../preload/index.js');  // Here, you can also use other preload
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, 'index.html');

async function createWindow() {
  window = new BrowserWindow({
    title: 'Main window',
    icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  window.setMenuBarVisibility(false)  // 隐藏窗口顶部工具栏，刷新按Ctrl+R，控制台按Ctrl+Shift+I

  // 避免用http协议跨域访问网址时报错
  app.commandLine.appendSwitch('disable-web-security');
  window.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      callback({ requestHeaders: { Origin: '*', ...details.requestHeaders } });
    },
  );
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        'Access-Control-Allow-Origin': ['*'],
        ...details.responseHeaders,
      },
    });
  });

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    window.loadURL(url)
    window.webContents.openDevTools()  // Open devTool if the app is not packaged
  } else {
    window.loadFile(indexHtml)
  }

  window.on("close", e => {  // 阻止窗口被直接关闭，而是先弹出确认窗口
    e.preventDefault();
    window.webContents.send("closeConfirm"); // 弹窗询问是否关闭
  })

  window.on("reload", e => {  // 重载之前也先弹出确认窗口
    e.preventDefault();
    window.webContents.send("reloadConfirm"); // 弹窗询问是否关闭
  })

  window.webContents.on('did-finish-load', () => { // 浏览器加载完成后开始计时
    window?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  window = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (window) {
    // Focus on the main window if the user tried to open another
    if (window.isMinimized()) window.restore()
    window.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// Electron浏览器的事件
ipcMain.handle("open-win", (_, arg) => {  // 窗口打开时
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }    
})
ipcMain.on("openDevTools", () => window.webContents.openDevTools());  // 打开开发人员工具
ipcMain.on("closeDevTools", () => window.webContents.closeDevTools());   // 关闭开发人员工具
ipcMain.on("closeWindow", () => window.destroy());   // 关闭窗口
ipcMain.on("reload", () => window.reload());  // 重载页面