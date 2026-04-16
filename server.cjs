// server.js - Pet Wash™ 2025 Production Server
// Simplified, deployment-ready Express server for Replit deployments

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// General rate limiter for all routes in this static server (200 req/15min per IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

app.use(generalLimiter);

// Trust proxy for Replit reverse proxy (required for secure cookies and proper IPs)
app.set('trust proxy', 1);

// Serve static files from Vite build output (dist/public)
const publicPath = path.join(__dirname, 'dist', 'public');
app.use(express.static(publicPath));

// Root health check for Replit deployment verification
app.get('/', (req, res) => {
  res.status(200).send('✅ Pet Wash™ server healthy');
});

// Health endpoint for Replit deployment monitoring
// Configure this as your health check URL in Replit Deployments
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'petwash',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Additional status endpoint (optional)
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    version: '2025.1',
    platform: 'Pet Wash™',
    healthy: true
  });
});

// SPA catch-all route - send index.html for all non-static routes
// This enables client-side routing (wouter/react-router)
app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  res.sendFile(indexPath);
});

// Replit-friendly port binding (uses PORT env var or fallback to 5000)
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('✅ Pet Wash™ Server Started');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📂 Static files: ${publicPath}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('========================================');
});
