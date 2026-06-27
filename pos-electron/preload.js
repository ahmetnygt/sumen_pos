const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    printReceipt: (orderData) => ipcRenderer.invoke('print-receipt', orderData)
});