const { initRemix } = require('remix-electron');
const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');

/** @type {BrowserWindow | undefined} */
let win;

/** @param {string} url */
async function createWindow(url) {
  win = new BrowserWindow({ show: false, width: 1200, height: 800 });
  await win.loadURL(url);
  win.show();

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
  await checkAndSelectDirectory();
}

async function checkAndSelectDirectory() {
  // Ensure that the window is defined
  if (!win) {
    console.error('BrowserWindow is not initialized');
    return;
  }

  try {
    // Check for existing cookie
    const existingCookies = await win.webContents.session.cookies.get({ name: 'selectedDirectory' });
    const existingPath = existingCookies[0]?.value;
    const configPath = existingPath ? path.join(existingPath, 'config.json') : null;

    // Check if the existing path is valid
    if (configPath && fs.existsSync(configPath)) {
      console.log('Valid config path found in cookie:', configPath);
      return; // Valid path found, do nothing
    }

    let validPathFound = false;

    while (!validPathFound) {
      // Show directory selection dialog
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        // User canceled or didn't select a directory, exit the application
        console.log('No directory selected, exiting application.');
        app.quit();
        return;
      }

      // Check if the selected directory contains config.json
      const selectedDirectory = result.filePaths[0];
      const newConfigPath = path.join(selectedDirectory, 'config.json');

      if (fs.existsSync(newConfigPath)) {
        // Valid path found, set the cookie
        const isDev = process.env.NODE_ENV === 'development';

        const url = isDev ? 'http://localhost:3000' : 'http://localhost';
        await win.webContents.session.cookies.set({
          url: url,
          name: 'selectedDirectory',
          value: selectedDirectory,
          expirationDate: new Date().getTime() / 100000 + 86400,
        });

        console.log('Valid directory selected:', selectedDirectory);
        validPathFound = true;
      } else {
        // Invalid path, prompt again
        console.log('Invalid directory selected, please select a directory containing config.json');
      }
    }
  } catch (error) {
    console.error('Error in checkAndSelectDirectory:', error);
    app.quit(); // Exit on error
  }
}

app.on('ready', () => {
  void (async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');

        await installExtension(REACT_DEVELOPER_TOOLS);
      }

      const url = await initRemix({
        serverBuild: path.join(__dirname, '../build/index.js'),
      });
      await createWindow(url);
    } catch (error) {
      dialog.showErrorBox('Error', getErrorStack(error));
      console.error(error);
    }
  })();
});

/** @param {unknown} error */
function getErrorStack(error) {
  return error instanceof Error ? error.stack || error.message : String(error);
}
