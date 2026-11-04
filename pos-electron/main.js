const { app, BrowserWindow, dialog, ipcMain } = require('electron'); // dialog eklendi
const { autoUpdater } = require('electron-updater'); // BÜYÜ BURADA: Güncelleyici eklendi
const path = require('path');
const fs = require('fs');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        fullscreen: true,
        frame: false,
        kiosk: true,
        title: "Sümen POS",
        backgroundColor: '#050505',
        icon: path.join(__dirname, 'build/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // İŞTE BÖYLE OLACAK
            webSecurity: true,
            allowRunningInsecureContent: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Electron'un uygulamanın paketlenip paketlenmediğini anlama yeteneği
    const isDev = !app.isPackaged;

    win.on('page-title-updated', (event) => {
        event.preventDefault();
    });

    if (isDev) {
        // GELİŞTİRME MODU: Vite'ın canlı sunucusuna bağlan
        win.loadURL('http://localhost:5573');

        // Benden sana kıyak: Geliştirici konsolunu da otomatik açsın
        // win.webContents.openDevTools();
    } else {
        // ÜRETİM MODU (Build): Müşterinin dükkanındaki .exe çalışırken burayı okur
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
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

ipcMain.handle('print-receipt', async (event, orderData) => {
    return new Promise((resolve) => {
        try {
            const device = new escpos.USB();
            const printer = new escpos.Printer(device, { encoding: "windows-1254" });
            const logoPath = path.join(__dirname, 'logo.png');

            const trToEng = (text) => {
                if (!text) return '';
                return text.replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
                           .replace(/Ü/g, 'U').replace(/ü/g, 'u')
                           .replace(/Ş/g, 'S').replace(/ş/g, 's')
                           .replace(/İ/g, 'I').replace(/ı/g, 'i')
                           .replace(/Ö/g, 'O').replace(/ö/g, 'o')
                           .replace(/Ç/g, 'C').replace(/ç/g, 'c');
            };

            const printBody = (image) => {
                device.open(function (error) {
                    if (error) {
                        console.error("Yazıcıya bağlanılamadı:", error);
                        return resolve({ success: false, message: error.message });
                    }

                    if (image) {
                        printer.align('ct').raster(image).text('');
                    }

                    printer
                        .font('b')
                        .size(1, 1)
                        .style('normal')
                        .align('ct')
                        .text('--------------------------------')
                        .align('lt');

                    (orderData.items || []).forEach(item => {
                        printer.text(trToEng(`${item.quantity}x ${item.name}`));
                        if (item.options) printer.text(trToEng(`    + ${item.options}`));
                        const lineTotal = item.lineTotal != null ? item.lineTotal : item.price;
                        printer.align('rt').text(`${lineTotal} TL`).align('lt');
                    });

                    printer
                        .align('ct')
                        .text('--------------------------------')
                        .align('rt')
                        .text(trToEng(`ARA TOPLAM: ${orderData.subTotal} TL`));

                    const indirim = parseFloat(orderData.discount);
                    if (indirim > 0) {
                        printer.text(trToEng(`INDIRIM: - ${indirim.toFixed(2)} TL`));
                    }

                    printer
                        .text('')
                        .style('b')
                        .size(2, 2)
                        .text(trToEng(`TOPLAM: ${orderData.total} TL`))
                        .text('')
                        .size(1, 1)
                        .style('normal')
                        .align('ct')
                        .text(trToEng('Bizi tercih ettiğiniz için'))
                        .text(trToEng('teşekkürler!'))
                        .text('')
                        .text(trToEng('Bize puan verin:'))
                        .qrimage('https://g.page/r/CRV3iTOcFFHfEBM/review', function () {
                            this.text('');
                            this.text('');
                            this.cut();
                            this.beep(1, 2);
                            this.close();
                            resolve({ success: true, message: "Fiş yazdırıldı" });
                        });
                });
            };

            if (!fs.existsSync(logoPath)) {
                printBody(null);
                return;
            }

            escpos.Image.load(logoPath, function (image) {
                if (!image) {
                    printBody(null);
                    return;
                }
                printBody(image);
            });
        } catch (err) {
            console.error('Yazdırma motoru patladı:', err);
            resolve({ success: false, message: err.message });
        }
    });
});