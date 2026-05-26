const { app, BrowserWindow, dialog, ipcMain } = require('electron'); // dialog eklendi
const { autoUpdater } = require('electron-updater'); // BÜYÜ BURADA: Güncelleyici eklendi
const path = require('path'); // <--- EKSİK OLAN BU!

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
            contextIsolation: false,
            webSecurity: false, // <--- Bunu ekle (DİKKAT: Sadece yerel POS uygulaması olduğu için güvenli)
            allowRunningInsecureContent: true // <--- Bunu ekle
        }
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools(); // Geliştirme aşamasında devtools aç
    } else {
        // DİKKAT: Burada 'dist' klasörünü ve loadFile metodunu kullanıyoruz
        const filePath = path.join(__dirname, 'dist', 'index.html');

        win.loadFile(filePath).catch(err => {
            console.error("HTML Dosyası Yüklenemedi:", err);
        });
    }
    win.webContents.openDevTools();
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