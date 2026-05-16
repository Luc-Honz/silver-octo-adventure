const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ukraineFrontline = require('./data/ukraine_frontline.json');
const datacenters = require('./data/datacenters.json');
const militaryBases = require('./data/us_military_bases.json');

app.get('/api', (req, res) => {
  res.json({
    version: '1.0.0',
    description: 'Geopolitical & infrastructure map API. All data is from public sources.',
    note: 'Ukraine front line is approximate based on public reporting. See data.lastUpdated for reference date.',
    endpoints: {
      'GET /api/ukraine/frontline': 'Ukraine war front line (GeoJSON LineString)',
      'GET /api/datacenters': 'Major cloud/data center locations (GeoJSON FeatureCollection)',
      'GET /api/datacenters?provider=aws': 'Filter datacenters by provider (aws, google, azure, meta, oracle, apple)',
      'GET /api/military/bases': 'US military base locations (GeoJSON FeatureCollection)',
      'GET /api/military/bases?branch=army': 'Filter bases by branch (army, navy, air force, marines, space force)',
      'GET /api/military/bases?country=japan': 'Filter bases by host country',
      'GET /api/all': 'All datasets combined in one response',
    },
  });
});

app.get('/api/ukraine/frontline', (req, res) => {
  res.json(ukraineFrontline);
});

app.get('/api/datacenters', (req, res) => {
  const { provider } = req.query;
  if (provider) {
    const features = datacenters.features.filter(
      (f) => f.properties.provider.toLowerCase() === provider.toLowerCase()
    );
    return res.json({ ...datacenters, features });
  }
  res.json(datacenters);
});

app.get('/api/military/bases', (req, res) => {
  const { branch, country } = req.query;
  let features = militaryBases.features;
  if (branch) {
    features = features.filter((f) =>
      f.properties.branch.toLowerCase().includes(branch.toLowerCase())
    );
  }
  if (country) {
    features = features.filter(
      (f) => f.properties.country.toLowerCase() === country.toLowerCase()
    );
  }
  res.json({ ...militaryBases, features });
});

app.get('/api/all', (req, res) => {
  res.json({
    ukraine_frontline: ukraineFrontline,
    datacenters: datacenters,
    military_bases: militaryBases,
  });
});

// Flight radar proxy — adsb.lol multi-region, cached 15 seconds
let flightCache = { data: null, fetchedAt: 0 };

const FLIGHT_REGIONS = [
  [45, -100, 2500],  // North America
  [50,   10, 2000],  // Europe
  [35,  120, 2500],  // East Asia
  [15,   78, 2000],  // South Asia / Middle East
  [-15, -55, 2000],  // South America
  [0,    20, 2500],  // Africa
  [-25, 135, 2000],  // Australia / Pacific
  [65,   80, 2500],  // Russia / Siberia
];

async function fetchRegion([lat, lon, dist]) {
  const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const json = await r.json();
    return json.ac || [];
  } catch {
    return [];
  }
}

app.get('/api/flights', async (req, res) => {
  const now = Date.now();
  if (flightCache.data && now - flightCache.fetchedAt < 15000) {
    return res.json(flightCache.data);
  }
  try {
    const results = await Promise.all(FLIGHT_REGIONS.map(fetchRegion));
    const seen = new Set();
    const planes = [];
    for (const ac of results.flat()) {
      if (!ac.hex || seen.has(ac.hex)) continue;
      if (ac.lat == null || ac.lon == null) continue;
      if (ac.alt_baro === 'ground' || ac.alt_baro <= 0) continue;
      if (!ac.r || !ac.r.startsWith('N')) continue;  // US registrations start with N
      seen.add(ac.hex);
      planes.push({
        icao:     ac.hex,
        callsign: (ac.flight || ac.hex).trim(),
        reg:      ac.r || '',
        lon:      ac.lon,
        lat:      ac.lat,
        altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
        velocity: ac.gs != null ? Math.round(ac.gs) : null,
        heading:  ac.track || 0,
        vertRate: ac.baro_rate || 0,
      });
    }
    flightCache = { data: { planes, time: Math.floor(now / 1000), count: planes.length }, fetchedAt: now };
    res.json(flightCache.data);
  } catch (e) {
    if (flightCache.data) return res.json(flightCache.data);
    res.status(503).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Map viewer: http://localhost:${PORT}/`);
  console.log(`API docs:   http://localhost:${PORT}/api`);
});
