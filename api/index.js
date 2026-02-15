const express = require('express');
const cors = require('cors');
const { connect } = require('../server/src/db');
const intakeRoutes = require('../server/src/routes/intake-routes');
const projectRoutes = require('../server/src/routes/project-routes');
const analyticsRoutes = require('../server/src/routes/analytics-routes');
const buildingRoutes = require('../server/src/routes/building-routes');
const reportRoutes = require('../server/src/routes/report-routes');

const app = express();

app.use(cors());
app.use(express.json());

// Lazy DB connection — persists across warm invocations
let dbReady = null;
app.use((req, res, next) => {
  if (!dbReady) dbReady = connect().catch((err) => { dbReady = null; throw err; });
  dbReady.then(() => next()).catch((err) => res.status(500).json({ error: true, message: 'DB connection failed: ' + err.message }));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/intake', intakeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId', analyticsRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/reports', reportRoutes);

module.exports = app;
