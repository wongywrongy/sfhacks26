require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
const intakeRoutes = require('./routes/intake-routes');
const projectRoutes = require('./routes/project-routes');
const analyticsRoutes = require('./routes/analytics-routes');
const buildingRoutes = require('./routes/building-routes');
const reportRoutes = require('./routes/report-routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/intake', intakeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId', analyticsRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/reports', reportRoutes);

async function start() {
  await connect();
  app.listen(PORT, () => {
    console.log(`CommonGround server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
