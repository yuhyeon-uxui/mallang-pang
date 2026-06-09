const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 250;
  const winHeight = 250;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: 50,
    y: height - winHeight - 50, // 모니터 좌측 하단
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
    if (mainWindow) {
      mainWindow.setPosition(pos.x, pos.y);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
