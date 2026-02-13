const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Database = require("better-sqlite3"); 

let db;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("renderer/index.html");
}

function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "database.sqlite");
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS seances (
      id TEXT PRIMARY KEY,
      event TEXT,
      date TEXT,
      time TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      seance_id TEXT,
      amount INTEGER,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      seance_id TEXT,
      seat_label TEXT,
      price INTEGER,
      sold_at TEXT,
      checked_in INTEGER DEFAULT 0,
      checked_in_at TEXT
    );
  `);
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});
