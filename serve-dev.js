#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 3000;

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Serve the main HTML file for any route (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`OrphiCrowdFund Dashboard served at http://localhost:${port}`);
  console.log('Dashboard should now be accessible in your browser!');
});
