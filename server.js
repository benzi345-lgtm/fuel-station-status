const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8090;
const DIR = __dirname;

// Use /tmp on Render (writable), fallback to app dir locally
const IS_RENDER = !!process.env.RENDER;
const DB_FILE = IS_RENDER
  ? "/tmp/fuel-db.json"
  : path.join(DIR, "db.json");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// ===== In-Memory Database with file backup =====
let _memDB = { status: {}, locations: {}, info: {}, updatedAt: null };

function loadDBFromFile() {
  try {
    _memDB = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    console.log("Loaded DB from file:", DB_FILE);
  } catch {
    console.log("No existing DB file, using defaults");
  }
}

function saveDBToFile() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(_memDB, null, 2), "utf8");
  } catch (e) {
    console.warn("Failed to write DB file:", e.message);
  }
}

// Load on startup
loadDBFromFile();

// ===== Server =====
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // CORS preflight
  if (req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // API: GET /api/data
  if (url === "/api/data" && req.method === "GET") {
    setCors(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(_memDB));
    return;
  }

  // API: POST /api/data
  if (url === "/api/data" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const incoming = JSON.parse(body);
        if (incoming.status) _memDB.status = incoming.status;
        if (incoming.locations) _memDB.locations = incoming.locations;
        if (incoming.info) _memDB.info = incoming.info;
        _memDB.updatedAt = new Date().toISOString();
        saveDBToFile();
        setCors(res);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        setCors(res);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(DIR, url === "/" ? "/index.html" : url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Server running on http://localhost:${PORT} (DB: ${DB_FILE})`));
