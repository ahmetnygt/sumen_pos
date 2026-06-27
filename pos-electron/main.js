const { app, BrowserWindow, dialog, ipcMain } = require('electron'); // dialog eklendi
const { autoUpdater } = require('electron-updater'); // BÜYÜ BURADA: Güncelleyici eklendi
const path = require('path'); // <--- EKSİK OLAN BU!
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
        icon: path.join(__dirname, 'build/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // İŞTE BÖYLE OLACAK
            webSecurity: true,
            allowRunningInsecureContent: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Electron'un uygulamanın paketlenip paketlenmediğini anlama yeteneği
    const isDev = !app.isPackaged;

    if (isDev) {
        // GELİŞTİRME MODU: Vite'ın canlı sunucusuna bağlan
        win.loadURL('http://localhost:5173');

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
            
            // BÜYÜ 1: Çince (GB18030) yerine standart Türkçe/Avrupa (windows-1254) kodlamasına geçtik
            const printer = new escpos.Printer(device, { encoding: "windows-1254" });
            const logoPath = path.join(__dirname, 'logo.png');

            // BÜYÜ 2: Çin malı yazıcıların Türkçe fontu desteklememesi ihtimaline karşı Kurşun Geçirmez Filtre
            const trToEng = (text) => {
                if (!text) return '';
                return text.replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
                           .replace(/Ü/g, 'U').replace(/ü/g, 'u')
                           .replace(/Ş/g, 'S').replace(/ş/g, 's')
                           .replace(/İ/g, 'I').replace(/ı/g, 'i')
                           .replace(/Ö/g, 'O').replace(/ö/g, 'o')
                           .replace(/Ç/g, 'C').replace(/ç/g, 'c');
            };

            escpos.Image.load(logoPath, function (image) {

                device.open(function (error) {
                    if (error) {
                        console.error("Yazıcıya bağlanılamadı:", error);
                        return resolve({ success: false, message: error.message });
                    }

                    printer
                        .align('ct')
                        .raster(image)       // Logoyu çak
                        .text('')
                        .font('b')
                        .size(1, 1)
                        .style('normal')
                        .text('--------------------------------')
                        .align('lt');

                    // 1. ÜRÜNLER, SEÇENEKLER VE FİYATLAR (Filtreden geçirilmiş)
                    orderData.items.forEach(item => {
                        // Ürün Adı
                        printer.text(trToEng(`${item.quantity}x ${item.name}`));

                        // Varsa seçenekler FİYATTAN ÖNCE yazsın
                        if (item.options) {
                            printer.text(trToEng(`    + ${item.options}`));
                        }

                        // Fiyat en sağa yaslı şekilde yazsın
                        printer.align('rt').text(`${item.price * item.quantity} TL`).align('lt');
                    });

                    printer
                        .align('ct')
                        .text('--------------------------------')
                        .align('rt')
                        .text(trToEng(`ARA TOPLAM: ${orderData.subTotal} TL`));

                    // 2. İNDİRİM SIFIRSA HİÇ YAZMA (Fukara işi durmasın)
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
                        // 3. QR KOD
                        .qrimage('https://g.page/r/CRV3iTOcFFHfEBM/review', function (err) {
                            this.text('');
                            this.text('');
                            this.cut();
                            this.beep(1, 2);
                            this.close();
                        });

                    resolve({ success: true, message: "Fiş yazdırıldı" });
                });
            });

        } catch (err) {
            console.error('Yazdırma motoru patladı:', err);
            resolve({ success: false, message: err.message });
        }
    });
});