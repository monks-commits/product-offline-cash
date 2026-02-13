const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

let db;

/* =========================
   WINDOW
========================= */

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

  win.loadFile("product-offline-cash/admin/index.html");
}

/* =========================
   DATABASE INIT
========================= */

function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "tickets.db");
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      seance_id TEXT,
      created_at TEXT,
      cashier TEXT,
      total INTEGER
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      seance_id TEXT,
      seat TEXT,
      price INTEGER,
      status TEXT DEFAULT 'sold',
      checked_in_at TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_seance ON tickets(seance_id);
    CREATE INDEX IF NOT EXISTS idx_seat ON tickets(seat);
  `);
}

/* =========================
   IPC HANDLERS
========================= */

/* Создание заказа */
ipcMain.handle("create-order", (event, payload) => {
  const { seance_id, seats, cashier } = payload;

  const orderId = uuidv4();
  const now = new Date().toISOString();

  let total = 0;

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, seance_id, created_at, cashier, total)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTicket = db.prepare(`
    INSERT INTO tickets (id, order_id, seance_id, seat, price)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    seats.forEach(seat => {
      total += seat.price;
    });

    insertOrder.run(orderId, seance_id, now, cashier || "cashier", total);

    seats.forEach(seat => {
      insertTicket.run(
        uuidv4(),
        orderId,
        seance_id,
        seat.label,
        seat.price
      );
    });
  });

  transaction();

  return {
    ok: true,
    order_id: orderId,
    total
  };
});

/* Получение проданных мест */
ipcMain.handle("get-sold-seats", (event, seanceId) => {
  const rows = db.prepare(`
    SELECT seat FROM tickets
    WHERE seance_id = ?
    AND status = 'sold'
  `).all(seanceId);

  return rows.map(r => r.seat);
});

/* Проверка билета (для сканера) */
ipcMain.handle("check-ticket", (event, qrPayload) => {
  if (!qrPayload || !qrPayload.includes("order:")) {
    return { ok: false, error: "invalid_qr" };
  }

  const orderMatch = qrPayload.match(/order:([^\|]+)/);
  if (!orderMatch) return { ok: false };

  const orderId = orderMatch[1];

  const ticket = db.prepare(`
    SELECT * FROM tickets
    WHERE order_id = ?
    LIMIT 1
  `).get(orderId);

  if (!ticket) {
    return { ok: false, error: "not_found" };
  }

  if (ticket.checked_in_at) {
    return {
      ok: false,
      error: "already_used",
      checked_in_at: ticket.checked_in_at
    };
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE tickets
    SET checked_in_at = ?
    WHERE id = ?
  `).run(now, ticket.id);

  return {
    ok: true,
    checked_in_at: now
  };
});

/* =========================
   APP START
========================= */

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
