require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Product = require('./models/Product'); // Your MongoDB schema
const User = require('./models/User');
const Order = require('./models/Order');

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



// // POST route to handle chat messages

// app.post('/api/chat', async (req, res) => {
//   try {
//     const userMessage = req.body.message;

//     // 1. RETRIEVAL: Get all active inventory from your local MongoDB
//     const inventory = await Product.find({ isActive: true });
    
//     // Format the inventory into a readable string for the AI
//     const inventoryText = inventory.map(item => 
//       `- ${item.name}: $${item.price} (${item.stockQuantity} in stock)`
//     ).join('\n');



//     // 2. AUGMENTATION: Build the strict System Instruction
//     const systemInstruction = `
//       You are SmartChat, the automated customer support agent for our tech store. 
//       Your tone is helpful, concise, and professional. 
      
//       Here is our live database inventory right now:
//       ${inventoryText}

//       RULES:
//       1. ONLY answer questions based on the inventory provided above.
//       2. If a user asks for an item not on the list, tell them it is out of stock.
//       3. If a user asks you to write code, do homework, or answer general knowledge questions, politely refuse and remind them you are a store assistant.
//       4. If a user wants to buy something that is in stock, guide them to use the checkout button.
//     `;

//     // 3. GENERATION: Connect to Gemini and send the massive prompt
//     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     const model = genAI.getGenerativeModel({ 
//       model: "gemini-2.5-flash",
//       systemInstruction: systemInstruction 
//     });

//     const result = await model.generateContent(userMessage);
//     const aiResponse = await result.response.text();

//     // Send the AI's answer back to the frontend
//     res.json({ reply: aiResponse });

//   } catch (error) {
//     console.error("Chat API Error:", error);
//     res.status(500).json({ reply: "I'm sorry, our system is currently experiencing technical difficulties." });
//   }
// });


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

// 2. Update Existing Stock AND Price
app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const { stockQuantity, price } = req.body; // Now grabbing price too

    await Product.findByIdAndUpdate(productId, { 
        stockQuantity: Number(stockQuantity),
        price: Number(price) 
    });
    
    res.json({ message: "Product updated successfully!" });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Failed to update product." });
  }
});





// ==========================================
// AI TOOL FUNCTIONS (Database Transactions)
// ==========================================

async function handlePlaceOrderDB(username, productName, quantity) {
    if (!username) return "Error: User must be logged in to buy items. Tell them to log in first.";
    
    // Find the product (using a case-insensitive search)
    const product = await Product.findOne({ name: new RegExp(productName, 'i') });
    
    if (!product) return `Error: We don't sell an item named ${productName}.`;
    if (product.stockQuantity < quantity) return `Error: We only have ${product.stockQuantity} in stock.`;

    // 1. Deduct the stock in MongoDB
    product.stockQuantity -= quantity;
    await product.save();

    // 2. Create the Order in MongoDB
    const newOrder = new Order({
        customerName: username,
        items: [{ productName: product.name, quantity: quantity, price: product.price }],
        totalAmount: product.price * quantity,
        status: 'Paid & Processing'
    });
    await newOrder.save();

    return `Success! Ordered ${quantity}x ${product.name}. Total charged: $${newOrder.totalAmount}. Order ID: ${newOrder._id}`;
}

async function handleCheckOrdersDB(username) {
    if (!username) return "Error: User must be logged in to view orders.";
    
    // Find all orders matching this exact username
    const orders = await Order.find({ customerName: username });
    if (orders.length === 0) return "You currently have no past orders.";

    // Format the orders into a readable string for the AI to understand
    return orders.map(o => 
        `- Order ID: ${o._id} | Items: ${o.items[0].quantity}x ${o.items[0].productName} | Total: $${o.totalAmount} | Status: ${o.status}`
    ).join('\n');
}

// THE UPGRADED AI CHAT ROUTE (Function Calling)

app.post('/api/chat', async (req, res) => {
  try {
    const { message, username } = req.body; // We get the logged-in username from the frontend!

    // 1. Get Live Inventory context
    const inventory = await Product.find({ isActive: true });
    const inventoryText = inventory.map(item => `- ${item.name}: $${item.price} (${item.stockQuantity} in stock)`).join('\n');

    // 2. Define the Tools (Give Gemini its "hands")
    const chatTools = [{
        functionDeclarations: [
            {
                name: "placeOrder",
                description: "Places a new order. Call this ONLY when the user explicitly asks to buy or order a specific item.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        productName: { type: "STRING", description: "The exact name of the product from our inventory" },
                        quantity: { type: "NUMBER", description: "The amount the user wants to buy" }
                    },
                    required: ["productName", "quantity"]
                }
            },
            {
                name: "checkMyOrders",
                description: "Retrieves the list of past orders for the currently logged-in user.",
                parameters: { type: "OBJECT", properties: {} } // No params needed, we use the session username
            }
        ]
    }];

    // 3. Setup Gemini Model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: `You are SmartChat, a helpful e-commerce AI. 
        The current logged-in user is: ${username || 'Guest'}. 
        Live Inventory: \n${inventoryText}\n
        Rules:
        1. If they ask to buy something, USE the placeOrder tool. Do NOT pretend to place an order without using the tool.
        2. If they ask for their order history, USE the checkMyOrders tool.
        3. Never invent or hallucinate products that are not in the Live Inventory list.`,
        tools: chatTools
    });

    // We use startChat() instead of generateContent() so we can have a back-and-forth dialogue
    const chat = model.startChat();
    let result = await chat.sendMessage(message);

    // 4. THE MAGIC: Did Gemini decide to use a tool?
    const calls = result.response.functionCalls();
    
    if (calls && calls.length > 0) {
        const call = calls[0]; // Get the tool it decided to use
        let toolResultData = "";

        // Execute your local Node.js Database logic based on the AI's choice
        if (call.name === "placeOrder") {
            console.log(`🤖 AI is executing a database purchase for ${username}...`);
            const { productName, quantity } = call.args;
            toolResultData = await handlePlaceOrderDB(username, productName, quantity);
        } else if (call.name === "checkMyOrders") {
            console.log(`🤖 AI is checking the database for ${username}'s orders...`);
            toolResultData = await handleCheckOrdersDB(username);
        }

        // Send the database result BACK to Gemini so it knows what happened!
        result = await chat.sendMessage([{
            functionResponse: {
                name: call.name,
                response: { result: toolResultData }
            }
        }]);
    }

    // 5. Send the final AI text back to the frontend UI
    res.json({ reply: result.response.text() });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ reply: "I'm sorry, our system is currently experiencing technical difficulties." });
  }
});










// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));