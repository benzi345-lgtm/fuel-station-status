const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8090;
const DIR = __dirname;
const DB_FILE = path.join(DIR, "db.json");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// ===== Database =====
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return { status: {}, locations: {}, info: {}, updatedAt: null };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Initialize db.json if not exists
if (!fs.existsSync(DB_FILE)) {
  writeDB({ status: {}, locations: {}, info: {}, updatedAt: null });
}

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

  // API: GET /api/data — read all data
  if (url === "/api/data" && req.method === "GET") {
    setCors(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(readDB()));
    return;
  }

  // API: POST /api/data — update data
  if (url === "/api/data" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const incoming = JSON.parse(body);
        const db = readDB();
        // Merge incoming fields
        if (incoming.status) db.status = incoming.status;
        if (incoming.locations) db.locations = incoming.locations;
        if (incoming.info) db.info = incoming.info;
        db.updatedAt = new Date().toISOString();
        writeDB(db);
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
}).listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
