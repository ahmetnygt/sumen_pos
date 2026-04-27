const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Sümen POS - Kasa Terminali",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // React sunucusunun (Vite) hazır olmasını bekleyen akıllı yükleyici
    win.loadURL('http://localhost:5173').catch((err) => {
        console.log('⏳ Vite sunucusu henüz hazır değil, 1.5 saniye sonra tekrar deneniyor...');
        setTimeout(() => {
            win.loadURL('http://localhost:5173');
        }, 1500);
    });

    // Menü çubuğunu gizle (Tam bir POS cihazı gibi görünmesi için)
    win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});