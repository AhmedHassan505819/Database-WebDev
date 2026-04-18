require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('./models/Product'); // Your MongoDB schema
const User = require('./models/User');

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

  // GET route for the Admin Dashboard to see all inventory
app.get('/api/inventory', async (req, res) => {
  try {
    // Fetch all products from MongoDB
    const inventory = await Product.find({});
    // Send them back to the frontend as a clean JSON array
    res.json(inventory);
  } catch (error) {
    console.error("Admin API Error:", error);
    res.status(500).json({ error: "Failed to load inventory" });
  }
});



// AUTHENTICATION ROUTES

// 1. Register a New User
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if the username or email is already in the database
    const existingUser = await User.findOne({ 
      $or: [{ username: username }, { email: email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: "Username or Email already taken!" });
    }

    // Auto-assign 'admin' role if the username is exactly 'admin'
    const role = username.toLowerCase() === 'admin' ? 'admin' : 'customer';
    
    // Create the new user object
    const newUser = new User({
      username: username,
      email: email,
      password: password, // Note: In a real app we'd use bcrypt to scramble this!
      role: role
    });

    // Save to MongoDB
    await newUser.save();
    
    // Send success message and safe user data back to the frontend
    res.json({ 
      message: "Registration successful", 
      user: { username: newUser.username, role: newUser.role } 
    });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Failed to register user." });
  }
});

// 2. Login an Existing User
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Search MongoDB for this exact username
    const user = await User.findOne({ username: username });

    // If the user doesn't exist, or the password doesn't match...
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid username or password!" });
    }

    // Success! Send safe user data back
    res.json({ 
      message: "Login successful", 
      user: { username: user.username, role: user.role } 
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Failed to login." });
  }
});



// ==========================================
// ADMIN INVENTORY ROUTES
// ==========================================

// 1. Add a Brand New Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, stockQuantity } = req.body;
    
    // Create the new product in MongoDB
    const newProduct = new Product({
      name: name,
      price: Number(price),
      stockQuantity: Number(stockQuantity),
      category: "General" // Default category
    });

    await newProduct.save();
    res.json({ message: "Product added successfully", product: newProduct });
  } catch (error) {
    console.error("Add Product Error:", error);
    res.status(500).json({ error: "Failed to add product." });
  }
});

// 2. Update Existing Stock Quantity
app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const { stockQuantity } = req.body;

    // Find the product by its MongoDB ID and update the stock
    await Product.findByIdAndUpdate(productId, { stockQuantity: Number(stockQuantity) });
    res.json({ message: "Stock updated successfully!" });
  } catch (error) {
    console.error("Update Stock Error:", error);
    res.status(500).json({ error: "Failed to update stock." });
  }
});




// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));