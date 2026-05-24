const { app, BrowserWindow, dialog, ipcMain } = require('electron'); // dialog eklendi
const { autoUpdater } = require('electron-updater'); // BÜYÜ BURADA: Güncelleyici eklendi

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        fullscreen: true,
        frame: false,
        kiosk: true,
        title: "Sümen POS",
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

app.whenReady().then(() => {
    createWindow();

    // 1. Uygulama açıldığında GitHub'ı kontrol et
    autoUpdater.checkForUpdatesAndNotify();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 2. Yeni Sürüm İndirildiğinde Kasiyere Sor
autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Güncelleme Hazır',
        message: 'Sümen POS için yeni bir sürüm indirildi. Şimdi yeniden başlatıp kurmak ister misiniz?',
        buttons: ['Evet, Yeniden Başlat', 'Daha Sonra']
    }).then((buttonIndex) => {
        if (buttonIndex.response === 0) { // Kasiyer "Evet" derse
            autoUpdater.quitAndInstall(); // Çık ve Yeni Sürümü Kur!
        }
    });
});

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

ipcMain.on('app-quit', () => {
    app.quit();
});