const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8090;
const DIR = __dirname;

// ===== Supabase Config =====
const SUPA_URL = process.env.SUPABASE_URL || "https://oaunodirbzauqmrquvdy.supabase.co";
const SUPA_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdW5vZGlyYnphdXFtcnF1dmR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzI3NTQsImV4cCI6MjA4OTY0ODc1NH0.MHLBGM9sEbHX2rtZBh4E_4YrOgzLGtEktBqZOgs7zv8";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// ===== In-Memory Database backed by Supabase =====
let _memDB = { status: {}, locations: {}, info: {}, updatedAt: null };

async function supaFetch(method, body) {
  const headers = {
    apikey: SUPA_KEY,
    Authorization: "Bearer " + SUPA_KEY,
    "Content-Type": "application/json",
    Prefer: method === "PATCH" ? "return=minimal" : undefined,
  };
  Object.keys(headers).forEach((k) => headers[k] === undefined && delete headers[k]);

  const url =
    method === "GET"
      ? SUPA_URL + "/rest/v1/app_data?select=data&id=eq.1"
      : SUPA_URL + "/rest/v1/app_data?id=eq.1";

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} failed: ${res.status} ${text}`);
  }
  return method === "GET" ? res.json() : null;
}

async function loadFromSupabase() {
  try {
    const rows = await supaFetch("GET");
    if (rows && rows.length > 0 && rows[0].data) {
      _memDB = rows[0].data;
      console.log("Loaded data from Supabase OK");
    } else {
      console.log("No data in Supabase, using defaults");
    }
  } catch (e) {
    console.warn("Failed to load from Supabase:", e.message);
  }
}

async function saveToSupabase() {
  try {
    await supaFetch("PATCH", { data: _memDB });
    console.log("Saved to Supabase OK");
  } catch (e) {
    console.warn("Failed to save to Supabase:", e.message);
  }
}

// ===== Server =====
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function startServer() {
  // Load data from Supabase on startup
  await loadFromSupabase();

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
      req.on("end", async () => {
        try {
          const incoming = JSON.parse(body);
          if (incoming.status) _memDB.status = incoming.status;
          if (incoming.locations) _memDB.locations = incoming.locations;
          if (incoming.info) _memDB.info = incoming.info;
          _memDB.updatedAt = new Date().toISOString();

          // Save to Supabase (persistent)
          await saveToSupabase();

          setCors(res);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          console.error("POST error:", e.message);
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
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  }).listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT} (Supabase storage)`)
  );
}

startServer();
