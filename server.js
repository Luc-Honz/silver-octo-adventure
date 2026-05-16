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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Map viewer: http://localhost:${PORT}/`);
  console.log(`API docs:   http://localhost:${PORT}/api`);
});
