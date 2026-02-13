const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  createOrder: (data) => ipcRenderer.invoke("create-order", data),
  getSoldSeats: (seanceId) => ipcRenderer.invoke("get-sold-seats", seanceId),
  checkTicket: (qr) => ipcRenderer.invoke("check-ticket", qr)
});
