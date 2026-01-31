// ================= FIREBASE IMPORT =================
import { ref, onValue, get } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const db = window.db;

// ================= CITY DETAILS =================
const cityName = "Nagpur";
const cityLat = 21.1458;
const cityLng = 79.0882;

// ================= DOM ELEMENTS =================
const card1 = document.getElementById('card1');
const card2 = document.getElementById('card2');
const card3 = document.getElementById('card3');
const card4 = document.getElementById('card4');

// ================= MAP SETUP =================
// Ensure the map element exists before initializing
if (!document.getElementById('map')) {
  console.error('Map container (#map) not found in DOM.');
}

const map = L.map("map").setView([cityLat, cityLng], 12);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  { attribution: "© OpenStreetMap" }
).addTo(map);

let markers = [];

// ================= HELPER FUNCTIONS =================
function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

function updateCards(a, b, c, d) {
  // Guard against missing DOM elements
  if (card1) card1.innerHTML = a || '—';
  if (card2) card2.innerHTML = b || '—';
  if (card3) card3.innerHTML = c || '—';
  if (card4) card4.innerHTML = d || '—';
}

function safeVal(snapshot) {
  const v = snapshot && snapshot.val ? snapshot.val() : null;
  return v || {};
}

// ======= RAIN VISUALS =======
const rainLayer = L.layerGroup().addTo(map);

function clearRain() {
  rainLayer.clearLayers();
}

/**
 * Return a random LatLng inside given bounds
 */
function randomLatLng(bounds) {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  const lat = Math.random() * (northEast.lat - southWest.lat) + southWest.lat;
  const lng = Math.random() * (northEast.lng - southWest.lng) + southWest.lng;
  return [lat, lng];
}

/**
 * Show animated raindrop "impacts" (pulse markers) on the current map view.
 * intensity: number of concurrent drops (suggest 10-60)
 */
function showRain(intensity = 20) {
  if (!effectsEnabled) return; // respect user toggle
  clearRain();
  const bounds = map.getBounds();
  const max = Math.max(5, Math.min(120, intensity));
  for (let i = 0; i < max; i++) {
    const [lat, lng] = randomLatLng(bounds);
    const icon = L.divIcon({
      className: 'raindrop-icon',
      html: `<span class="raindrop" style="animation-delay:${(Math.random()*0.8).toFixed(2)}s;"></span>`,
      iconSize: [12, 12]
    });
    const m = L.marker([lat, lng], { icon, interactive: false });
    rainLayer.addLayer(m);
    // Remove after a few seconds to keep layer light
    setTimeout(() => { rainLayer.removeLayer(m); }, 5000 + Math.random()*3000);
  }
}

/**
 * Update small badge in topbar to reflect raining
 */
const weatherBadgeEl = document.getElementById('weatherBadge');
let effectsEnabled = true; // controlled by UI toggle
const effectsStatusEl = document.getElementById('effectsStatus');
function setEffectsEnabled(enabled){
  effectsEnabled = !!enabled;
  if (effectsStatusEl) effectsStatusEl.textContent = effectsEnabled ? 'On' : 'Off';
}
function setWeatherBadge(isRaining, text = '') {
  if (!weatherBadgeEl) return;
  if (isRaining) {
    weatherBadgeEl.textContent = text || '🌧 Raining';
    weatherBadgeEl.style.display = 'inline-block';
  } else {
    weatherBadgeEl.textContent = '';
    weatherBadgeEl.style.display = 'none';
  }
}

// Simulate rain for demo/testing
window.simulateRain = function(intensity = 70){
  showRain(intensity);
  setWeatherBadge(true, '🌧 Demo Rain');
  setTimeout(() => { if(effectsEnabled) { clearRain(); setWeatherBadge(false);} }, 7000);
};

// Wire UI controls when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('effectsToggle');
  const simBtn = document.getElementById('simulateRainBtn');
  const testBtn = document.getElementById('testDbBtn');
  const dbStatusEl = document.getElementById('dbStatus');
  function updateDBStatus(text, cls){
    if (dbStatusEl) {
      dbStatusEl.textContent = `DB: ${text}`;
      dbStatusEl.dataset.state = cls || '';
    }
  }

  async function testDB(){
    if (!db) { updateDBStatus('not initialized', 'warning'); return console.warn('DB not initialized'); }
    updateDBStatus('testing...', 'testing');
    try{
      const snapshot = await get(ref(db, '/'));
      if (!snapshot.exists()){
        updateDBStatus('connected (empty)', 'ok');
        console.info('DB root empty.');
      } else {
        updateDBStatus('connected', 'ok');
        console.info('DB root:', snapshot.val());
      }
    } catch(err) {
      updateDBStatus('error', 'error');
      console.error('DB test failed:', err);
    }
  }

  if (toggle){
    toggle.addEventListener('change', (e) => setEffectsEnabled(e.target.checked));
    setEffectsEnabled(toggle.checked);
  }
  if (simBtn){
    simBtn.addEventListener('click', () => window.simulateRain());
  }
  if (testBtn){
    testBtn.addEventListener('click', testDB);
  }

  // Auto-run a DB test if available
  if (db) testDB();
});

// ================= MODULES =================

// 🌦 WEATHER (FROM FIREBASE: weather/)
window.loadWeather = function () {
  if (!db) return console.warn('Firebase DB not initialized yet.');
  const weatherRef = ref(db, "weather");

  onValue(weatherRef, (snapshot) => {
    const w = safeVal(snapshot);

    updateCards(
      `🌡 Temperature<br><b>${w.temperature ?? 'N/A'}</b>`,
      `💨 Wind<br><b>${w.wind ?? 'N/A'}</b>`,
      `☁ Condition<br><b>${w.condition ?? 'N/A'}</b>`,
      `💧 Humidity<br><b>${w.humidity ?? 'N/A'}</b>`
    );

    // Detect rain by condition text or explicit fields
    const cond = (w.condition || '').toString().toLowerCase();
    const precip = Number(w.precipitation ?? w.precipIntensity ?? 0);
    const isRaining = /rain|shower|drizzle|storm/i.test(cond) || w.rain === true || precip > 0;
    if (isRaining) {
      // Map precip to intensity (simple heuristic)
      const intensity = precip > 1 ? Math.min(80, Math.round(precip * 25)) : 30;
      showRain(intensity);
      setWeatherBadge(true, `🌧 ${w.condition ?? 'Rain'}`);
    } else {
      clearRain();
      setWeatherBadge(false);
    }

  }, (err) => console.error('Weather DB error:', err));

  clearMarkers();
  markers.push(
    L.marker([cityLat, cityLng]).addTo(map)
      .bindPopup("Weather Monitoring Station")
  );
};

// 🚦 TRAFFIC (traffic/)
window.loadTraffic = function () {
  if (!db) return console.warn('Firebase DB not initialized yet.');
  const refTraffic = ref(db, "traffic");

  onValue(refTraffic, (s) => {
    const t = safeVal(s);
    updateCards(
      `🚦 Level<br><b>${t.level ?? 'N/A'}</b>`,
      `🛣 Congestion<br><b>${t.congestion ?? 'N/A'}</b>`,
      `⏱ Delay<br><b>${t.delay ?? 'N/A'}</b>`,
      `🚗 Vehicles<br><b>${t.vehicles ?? 'N/A'}</b>`
    );
  }, (err) => console.error('Traffic DB error:', err));

  clearRain();
  clearMarkers();
  markers.push(
    L.circle([cityLat - 0.02, cityLng + 0.02], {
      radius: 900,
      color: "red",
      fillOpacity: 0.5
    }).addTo(map)
  );
};

// ⚡ ENERGY (energy/)
window.loadEnergy = function () {
  if (!db) return console.warn('Firebase DB not initialized yet.');
  onValue(ref(db, "energy"), (s) => {
    const e = safeVal(s);
    updateCards(
      `⚡ Usage<br><b>${e.usage ?? 'N/A'}</b>`,
      `🔋 Renewable<br><b>${e.renewable ?? 'N/A'}</b>`,
      `💡 Efficiency<br><b>${e.efficiency ?? 'N/A'}</b>`,
      `🔥 Peak<br><b>${e.peak ?? 'N/A'}</b>`
    );
  }, (err) => console.error('Energy DB error:', err));

  clearRain();
  clearMarkers();
  markers.push(
    L.circle([cityLat, cityLng - 0.03], {
      radius: 800,
      color: "yellow",
      fillOpacity: 0.5
    }).addTo(map)
  );
};

// 💡 STREET LIGHTS (streetLights/)
window.loadStreetLights = function () {
  if (!db) return console.warn('Firebase DB not initialized yet.');
  onValue(ref(db, "streetLights"), (s) => {
    const l = safeVal(s);
    updateCards(
      `💡 Total<br><b>${l.total ?? 'N/A'}</b>`,
      `✅ Active<br><b>${l.active ?? 'N/A'}</b>`,
      `❌ Faulty<br><b>${l.faulty ?? 'N/A'}</b>`,
      `⚡ Mode<br><b>${l.mode ?? 'N/A'}</b>`
    );
  }, (err) => console.error('StreetLights DB error:', err));

  clearRain();
  clearMarkers();
  markers.push(
    L.marker([cityLat + 0.01, cityLng + 0.01]).addTo(map)
  );
};

// ℹ ABOUT CITY (static)
window.loadAbout = function () {
  updateCards(
    "🏙 City<br><b>Nagpur</b>",
    "👥 Population<br><b>24 Lakh+</b>",
    "📐 Area<br><b>217 km²</b>",
    "🏆 Status<br><b>Smart City</b>"
  );

  clearRain();
  clearMarkers();
  markers.push(L.marker([cityLat, cityLng]).addTo(map));
};

// DEFAULT LOAD
if (db) {
  loadWeather();
} else {
  console.warn('Firebase not initialized yet. Call `loadWeather` manually after init.');
}
