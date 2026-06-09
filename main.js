const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 800;
  const winHeight = 800;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: 0,
    y: height - winHeight, // 모니터 좌측 하단 (투명 창이므로 넉넉하게 800x800 사용)
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  mainWindow.loadFile('index.html');
  
  // 종료 이벤트 처리
  ipcMain.on('close-app', () => {
    app.quit();
  });

  // 창 이동 이벤트 처리 (드래그)
  ipcMain.on('move-window', (event, pos) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setPosition(Math.round(pos.x), Math.round(pos.y));
    }
  });

  // 항상 위에 고정 토글
  ipcMain.on('toggle-top', (event, isTop) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setAlwaysOnTop(isTop);
    }
  });

  // 투명 영역 클릭/스크롤 통과 처리
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
