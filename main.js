const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;
let splash; // Variable as requested

function createWindow() {
    // 1. Create Splash Window
    splash = new BrowserWindow({
        width: 500,
        height: 300,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splash.loadFile('splash.html');

    // 2. Create Main Window (Hidden initially)
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "CyberVault - Blockchain Forensic Ledger",
        backgroundColor: '#0f172a', // Slate-950
        show: false, // Hidden until ready
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        autoHideMenuBar: true
    });

    // Load the live Vercel URL
    mainWindow.loadURL('https://cybercrime-evidence-vault.vercel.app');

    // Security: Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // 3. Handle Ready-to-Show Event
    mainWindow.once('ready-to-show', () => {
        // Optional: Add a small timeout (e.g. 2s) to let the splash animation run.
        // If you want purely "load-based", remove setTimeout and just run the lines inside.
        setTimeout(() => {
            splash.destroy();
            mainWindow.show();
        }, 2500);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App Lifecycle
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
