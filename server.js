require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('./models/Product'); // Your MongoDB schema

const app = express();

// Middleware to parse JSON and allow your frontend to talk to the backend
app.use(express.json());
app.use(cors());
app.use(express.static('public'));


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



// POST route to handle chat messages
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    // 1. RETRIEVAL: Get all active inventory from your local MongoDB
    const inventory = await Product.find({ isActive: true });
    
    // Format the inventory into a readable string for the AI
    const inventoryText = inventory.map(item => 
      `- ${item.name}: $${item.price} (${item.stockQuantity} in stock)`
    ).join('\n');

    // 2. AUGMENTATION: Build the strict System Instruction
    const systemInstruction = `
      You are SmartChat, the automated customer support agent for our tech store. 
      Your tone is helpful, concise, and professional. 
      
      Here is our live database inventory right now:
      ${inventoryText}

      RULES:
      1. ONLY answer questions based on the inventory provided above.
      2. If a user asks for an item not on the list, tell them it is out of stock.
      3. If a user asks you to write code, do homework, or answer general knowledge questions, politely refuse and remind them you are a store assistant.
      4. If a user wants to buy something that is in stock, guide them to use the checkout button.
    `;

    // 3. GENERATION: Connect to Gemini and send the massive prompt
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction 
    });

    const result = await model.generateContent(userMessage);
    const aiResponse = await result.response.text();

    // Send the AI's answer back to the frontend
    res.json({ reply: aiResponse });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ reply: "I'm sorry, our system is currently experiencing technical difficulties." });
  }
});





// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));