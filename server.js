require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware to parse JSON and allow your frontend to talk to the backend
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB via Mongoose!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// A simple test route to make sure things are working
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'SmartChat Backend is live!', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    ai_configured: !!process.env.GEMINI_API_KEY 
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));