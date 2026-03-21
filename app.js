// ===== API-based Storage =====
const API_URL = "/api/data";

// In-memory cache (loaded from server)
let _db = { status: {}, locations: {}, info: {}, updatedAt: null };

async function fetchDB(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        _db = await res.json();
        return _db;
      }
    } catch (e) {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  console.warn("Failed to fetch data after retries, using defaults");
  return _db;
}

async function saveDB(fields) {
  Object.assign(_db, fields);
  _db.updatedAt = new Date().toISOString();
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  } catch (e) {
    console.warn("Failed to save data");
  }
}

function getStatus() {
  const s = _db.status || {};
  // Fill defaults
  STATIONS.forEach((st) => {
    if (!s[st.id]) {
      s[st.id] = {};
      FUEL_TYPES.forEach((f) => { s[st.id][f.id] = true; });
    }
  });
  return s;
}

function getLocations() {
  const l = _db.locations || {};
  STATIONS.forEach((s) => {
    if (!l[s.id]) l[s.id] = { lat: s.lat, lng: s.lng };
  });
  return l;
}

function getInfo() {
  const i = _db.info || {};
  STATIONS.forEach((s) => {
    if (!i[s.id]) i[s.id] = { name: s.name, address: s.address };
  });
  return i;
}

// ===== Google Maps Link =====
function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function mapsViewUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ===== Customer Page =====
function renderCustomerPage() {
  const container = document.getElementById("stations");
  if (!container) return;

  const status = getStatus();
  const locations = getLocations();
  const stationInfo = getInfo();

  if (_db.updatedAt) {
    const timeEl = document.getElementById("last-updated");
    if (timeEl) {
      const d = new Date(_db.updatedAt);
      timeEl.textContent = `อัพเดทล่าสุด: ${d.toLocaleDateString("th-TH")} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  container.innerHTML = STATIONS.map((station) => {
    const loc = locations[station.id] || { lat: station.lat, lng: station.lng };
    const info = stationInfo[station.id] || { name: station.name, address: station.address };
    const stationStatus = status[station.id] || {};
    const availableCount = FUEL_TYPES.filter((f) => stationStatus[f.id]).length;
    const allAvailable = availableCount === FUEL_TYPES.length;
    const noneAvailable = availableCount === 0;

    let headerBg, headerIcon;
    if (noneAvailable) {
      headerBg = "bg-red-500";
      headerIcon = "น้ำมันหมดทุกประเภท";
    } else if (allAvailable) {
      headerBg = "bg-gradient-to-r from-blue-600 to-sky-500";
      headerIcon = "มีน้ำมันครบทุกประเภท";
    } else {
      headerBg = "bg-amber-500";
      headerIcon = `มีน้ำมัน ${availableCount}/${FUEL_TYPES.length} ประเภท`;
    }

    const fuelsHtml = FUEL_TYPES.map((fuel) => {
      const available = stationStatus[fuel.id];
      return `
        <div class="flex items-center justify-between py-2 px-3 rounded-lg ${available ? "bg-sky-50" : "bg-red-50"}">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${fuel.color}"></span>
            <span class="font-medium text-gray-700">${fuel.name}</span>
          </div>
          <span class="${available ? "text-blue-600 font-bold" : "text-red-500 font-bold"}">
            ${available ? "มีน้ำมัน" : "หมด"}
          </span>
        </div>`;
    }).join("");

    return `
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
        <div class="${headerBg} text-white px-5 py-3 flex items-center justify-between">
          <h2 class="text-lg font-bold">${info.name}</h2>
          <span class="text-sm opacity-90">${headerIcon}</span>
        </div>
        <div class="p-5">
          <p class="text-gray-500 text-sm mb-3 flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            ${info.address}
          </p>
          <div class="space-y-2 mb-4">
            ${fuelsHtml}
          </div>
          <div class="flex gap-2">
            <a href="${mapsViewUrl(loc.lat, loc.lng)}" target="_blank"
               class="flex-1 text-center py-2 px-4 bg-sky-50 text-blue-600 rounded-xl font-medium hover:bg-sky-100 transition-colors text-sm">
              ดูแผนที่
            </a>
            <a href="${mapsUrl(loc.lat, loc.lng)}" target="_blank"
               class="flex-1 text-center py-2 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm">
              นำทาง
            </a>
          </div>
        </div>
      </div>`;
  }).join("");
}

// ===== Admin Page =====
function renderAdminPage() {
  const container = document.getElementById("admin-stations");
  if (!container) return;

  const status = getStatus();
  const stationInfo = getInfo();

  container.innerHTML = STATIONS.map((station) => {
    const stationStatus = status[station.id] || {};
    const info = stationInfo[station.id] || { name: station.name, address: station.address };

    const togglesHtml = FUEL_TYPES.map((fuel) => {
      const available = stationStatus[fuel.id];
      const toggleId = `toggle-${station.id}-${fuel.id}`;
      return `
        <div class="flex items-center justify-between py-3 px-4 rounded-xl ${available ? "bg-green-50" : "bg-red-50"}">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full inline-block" style="background:${fuel.color}"></span>
            <span class="font-medium">${fuel.name}</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="${toggleId}" class="sr-only peer"
                   ${available ? "checked" : ""}
                   onchange="toggleFuel(${station.id}, '${fuel.id}', this.checked)">
            <div class="w-14 h-7 bg-red-300 peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
            <div class="absolute left-1 top-0.5 bg-white w-6 h-6 rounded-full shadow peer-checked:translate-x-7 transition-transform"></div>
          </label>
        </div>`;
    }).join("");

    return `
      <div class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div class="bg-gray-700 text-white px-5 py-3">
          <h2 class="text-lg font-bold">สาขา ${station.id}</h2>
        </div>
        <div class="p-5 space-y-3">
          <div>
            <label class="text-xs text-gray-500 font-medium">ชื่อปั๊ม</label>
            <input type="text" id="name-${station.id}" value="${info.name}"
                   class="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
          </div>
          <div>
            <label class="text-xs text-gray-500 font-medium">ที่อยู่</label>
            <input type="text" id="addr-${station.id}" value="${info.address}"
                   class="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" />
          </div>
          <button onclick="saveStationFields(${station.id})"
                  class="w-full py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm">
            บันทึก
          </button>
          <p id="saved-${station.id}" class="text-green-600 text-xs text-center hidden">บันทึกเรียบร้อยแล้ว</p>
          <div class="border-t pt-3 space-y-2">
            ${togglesHtml}
          </div>
        </div>
      </div>`;
  }).join("");
}

async function saveStationFields(stationId) {
  const nameEl = document.getElementById(`name-${stationId}`);
  const addrEl = document.getElementById(`addr-${stationId}`);
  const savedEl = document.getElementById(`saved-${stationId}`);
  const info = getInfo();
  if (!info[stationId]) info[stationId] = {};
  info[stationId].name = nameEl.value;
  info[stationId].address = addrEl.value;
  _db.info = info;
  await saveDB({ info });
  if (savedEl) {
    savedEl.classList.remove("hidden");
    setTimeout(() => savedEl.classList.add("hidden"), 3000);
  }
}

async function toggleFuel(stationId, fuelId, value) {
  const status = getStatus();
  if (!status[stationId]) status[stationId] = {};
  status[stationId][fuelId] = value;
  _db.status = status;
  await saveDB({ status });
  renderAdminPage();
}

async function setAllFuel(value) {
  const status = getStatus();
  STATIONS.forEach((s) => {
    if (!status[s.id]) status[s.id] = {};
    FUEL_TYPES.forEach((f) => {
      status[s.id][f.id] = value;
    });
  });
  _db.status = status;
  await saveDB({ status });
  renderAdminPage();
}

// ===== Customer Map =====
function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const status = getStatus();
  const locations = getLocations();
  const stationInfo = getInfo();

  const lats = STATIONS.map((s) => (locations[s.id] || s).lat || s.lat);
  const lngs = STATIONS.map((s) => (locations[s.id] || s).lng || s.lng);
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  const map = L.map("map").setView([centerLat, centerLng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  STATIONS.forEach((station) => {
    const loc = locations[station.id] || { lat: station.lat, lng: station.lng };
    const info = stationInfo[station.id] || { name: station.name, address: station.address };
    const stationStatus = status[station.id] || {};
    const availableCount = FUEL_TYPES.filter((f) => stationStatus[f.id]).length;
    const allAvailable = availableCount === FUEL_TYPES.length;
    const noneAvailable = availableCount === 0;

    const color = noneAvailable ? "#ef4444" : allAvailable ? "#2563eb" : "#eab308";

    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
               <span style="color:white;font-weight:bold;font-size:12px;">${station.id}</span>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const fuelList = FUEL_TYPES.map((f) => {
      const avail = stationStatus[f.id];
      return `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;">
                <span>${f.name}</span>
                <strong style="color:${avail ? "#16a34a" : "#dc2626"}">${avail ? "มี" : "หมด"}</strong>
              </div>`;
    }).join("");

    const popup = `
      <div style="min-width:180px;">
        <strong style="font-size:14px;">${info.name}</strong>
        <p style="color:#666;font-size:11px;margin:4px 0 8px;">${info.address}</p>
        ${fuelList}
        <a href="${mapsUrl(loc.lat, loc.lng)}" target="_blank"
           style="display:block;text-align:center;margin-top:8px;padding:6px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:bold;">
          นำทาง Google Maps
        </a>
      </div>`;

    L.marker([loc.lat, loc.lng], { icon }).addTo(map).bindPopup(popup);
  });
}

// ===== Admin Map (Location Picker) =====
let adminMap = null;
let adminMarkers = {};
let selectedStationId = null;

function initAdminMap() {
  const mapEl = document.getElementById("admin-map");
  if (!mapEl) return;

  const locations = getLocations();
  const stationInfo = getInfo();

  // Populate station dropdown
  const select = document.getElementById("station-select");
  select.innerHTML = STATIONS.map(
    (s) => `<option value="${s.id}">${(stationInfo[s.id] && stationInfo[s.id].name) || s.name}</option>`
  ).join("");
  selectedStationId = STATIONS[0].id;

  // Calculate center
  const lats = STATIONS.map((s) => (locations[s.id] || s).lat || s.lat);
  const lngs = STATIONS.map((s) => (locations[s.id] || s).lng || s.lng);
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  adminMap = L.map("admin-map").setView([centerLat, centerLng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(adminMap);

  // Place existing markers (draggable)
  STATIONS.forEach((station) => {
    const loc = locations[station.id] || { lat: station.lat, lng: station.lng };

    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
               <span style="color:white;font-weight:bold;font-size:13px;">${station.id}</span>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([loc.lat, loc.lng], { icon, draggable: true })
      .addTo(adminMap)
      .bindTooltip(station.name, { direction: "top", offset: [0, -16] });

    marker.on("dragend", async function () {
      const pos = marker.getLatLng();
      const locs = getLocations();
      locs[station.id] = { lat: pos.lat, lng: pos.lng };
      _db.locations = locs;
      await saveDB({ locations: locs });
      updateCoordDisplay(station.id);
    });

    marker.on("click", function () {
      selectedStationId = station.id;
      select.value = station.id;
      updateCoordDisplay(station.id);
      highlightMarker(station.id);
    });

    adminMarkers[station.id] = marker;
  });

  // Click on map to move selected station's marker
  adminMap.on("click", async function (e) {
    if (!selectedStationId) return;
    const marker = adminMarkers[selectedStationId];
    marker.setLatLng(e.latlng);
    const locs = getLocations();
    locs[selectedStationId] = { lat: e.latlng.lat, lng: e.latlng.lng };
    _db.locations = locs;
    await saveDB({ locations: locs });
    updateCoordDisplay(selectedStationId);
  });

  updateCoordDisplay(selectedStationId);
  highlightMarker(selectedStationId);
}

function onStationSelect() {
  const select = document.getElementById("station-select");
  selectedStationId = parseInt(select.value);
  const locations = getLocations();
  const loc = locations[selectedStationId];
  if (loc) {
    adminMap.panTo([loc.lat, loc.lng]);
  }
  updateCoordDisplay(selectedStationId);
  highlightMarker(selectedStationId);
}

function highlightMarker(stationId) {
  STATIONS.forEach((s) => {
    const marker = adminMarkers[s.id];
    const isSelected = s.id === stationId;
    const color = isSelected ? "#ef4444" : "#3b82f6";
    const size = isSelected ? 36 : 32;
    marker.setIcon(
      L.divIcon({
        className: "",
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,${isSelected ? "0.5" : "0.3"});display:flex;align-items:center;justify-content:center;">
                 <span style="color:white;font-weight:bold;font-size:${isSelected ? 15 : 13}px;">${s.id}</span>
               </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
    );
  });
}

function updateCoordDisplay(stationId) {
  const el = document.getElementById("coord-display");
  if (!el) return;
  const locs = getLocations();
  const loc = locs[stationId];
  if (loc) {
    el.textContent = `พิกัด: ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
  }
}

// ===== Init: Load data then render =====
async function initCustomerApp() {
  await fetchDB();
  // Hide loading, show content
  const loading = document.getElementById("loading");
  const mapSection = document.getElementById("map-section");
  const stationsSection = document.getElementById("stations-section");
  if (loading) loading.classList.add("hidden");
  if (mapSection) mapSection.classList.remove("hidden");
  if (stationsSection) stationsSection.classList.remove("hidden");
  renderCustomerPage();
  initMap();
}

async function initAdminApp() {
  await fetchDB();
  renderAdminPage();
  initAdminMap();
}

async function refreshCustomerPage() {
  await fetchDB();
  renderCustomerPage();
}
