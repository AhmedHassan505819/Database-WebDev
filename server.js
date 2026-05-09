require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Schemas
const Product = require('./models/Product');
const User = require('./models/User');
const Order = require('./models/Order');
const ChatSession = require('./models/ChatSession');
const AuditLog = require('./models/AuditLog');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB!'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ==========================================
// FRONTEND ROUTES
// ==========================================
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/chat', (req, res) => res.sendFile(__dirname + '/public/chat.html'));

// ==========================================
// AUTH & ADMIN API
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) return res.status(400).json({ error: "Username or Email taken!" });

        const role = username.toLowerCase() === 'admin' ? 'admin' : 'customer';
        const newUser = new User({ username, email, password, role });
        await newUser.save();

        res.json({ message: "Success", user: { username: newUser.username, role: newUser.role } });
    } catch (error) { res.status(500).json({ error: "Registration failed." }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.password !== password) return res.status(401).json({ error: "Invalid credentials!" });
        res.json({ message: "Success", user: { username: user.username, role: user.role } });
    } catch (error) { res.status(500).json({ error: "Login failed." }); }
});

app.get('/api/inventory', async (req, res) => {
    try { res.json(await Product.find({})); }
    catch (error) { res.status(500).json({ error: "Failed to load inventory" }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, stockQuantity } = req.body;
        const newProduct = new Product({ name, price: Number(price), stockQuantity: Number(stockQuantity), category: "General" });
        await newProduct.save();
        res.json({ message: "Success", product: newProduct });
    } catch (error) { res.status(500).json({ error: "Failed to add product." }); }
});


// ==========================================
// ADMIN API: UPDATE INVENTORY WITH AUDIT LOGS
// ==========================================
app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const newPrice = Number(req.body.price);
    const newQty = Number(req.body.stockQuantity);

    // Get the old product FIRST so we can compare
    const oldProduct = await Product.findById(productId);
    if (!oldProduct) return res.status(404).json({ error: "Product not found" });

    // 🔥 ADB FEATURE 3: AUDIT LOGGING TRIGGER
    // If the admin changed the price, write it to the immutable ledger
    if (oldProduct.price !== newPrice) {
        await AuditLog.create({
            action: "PRICE_CHANGE",
            productId: oldProduct._id,
            productName: oldProduct.name,
            oldValue: oldProduct.price,
            newValue: newPrice
        });
    }

    if (oldProduct.stockQuantity !== newQty) {
        await AuditLog.create({
            action: "MANUAL_STOCK_OVERRIDE", // Explicitly naming it so you know it wasn't a normal sale
            productId: oldProduct._id,
            productName: oldProduct.name,
            oldValue: oldProduct.stockQuantity,
            newValue: newQty
        });
    }

    // Now update the actual product
    oldProduct.price = newPrice;
    oldProduct.stockQuantity = newQty;
    await oldProduct.save();

    res.json({ message: "Success - Product updated and audited." });
  } catch (error) { 
      res.status(500).json({ error: "Failed to update." }); 
  }
});



// ==========================================
// ADVANCED DB: AGGREGATION PIPELINE ANALYTICS
// ==========================================
app.get('/api/analytics', async (req, res) => {
    try {
        // Pipeline 1: Calculate Total Revenue & Order Count in ONE database query
        const globalStats = await Order.aggregate([
            {
                $group: {
                    _id: null, // Group everything together
                    totalRevenue: { $sum: "$totalAmount" }, // Add up all totalAmount fields
                    totalOrders: { $sum: 1 } // Count the documents
                }
            }
        ]);

        // Pipeline 2: Rank the Top 5 Spenders
        const topCustomers = await Order.aggregate([
            {
                $group: {
                    _id: "$customerName", // Group by the customer's name
                    totalSpent: { $sum: "$totalAmount" } // Add up what this specific person spent
                }
            },
            {
                $sort: { totalSpent: -1 } // Sort descending (highest spenders first)
            },
            {
                $limit: 5 // Only keep the top 5
            },
            {
                $project: {
                    name: "$_id",      // Rename _id to 'name' for the frontend
                    total: "$totalSpent", // Rename totalSpent to 'total'
                    _id: 0           // Hide the original _id field
                }
            }
        ]);

        // Safely extract the numbers (in case the DB is completely empty)
        const revenue = globalStats.length > 0 ? globalStats[0].totalRevenue.toFixed(2) : "0.00";
        const orders = globalStats.length > 0 ? globalStats[0].totalOrders : 0;

        res.json({
            totalRevenue: revenue,
            totalOrders: orders,
            topCustomers: topCustomers
        });

    } catch (error) {
        console.error("Aggregation Error:", error);
        res.status(500).json({ error: "Failed to run DB analytics" });
    }
});
// ==========================================
// DELETE A CHAT SESSION
// ==========================================
app.delete('/api/chat/:sessionId', async (req, res) => {
    try {
        await ChatSession.findByIdAndDelete(req.params.sessionId);
        res.json({ message: "Chat deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete chat" });
    }
});

// ==========================================
// SESSION API
// ==========================================
app.get('/api/sessions/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(await ChatSession.find({ userId: user._id }).sort({ updatedAt: -1 }));
    } catch (err) { res.status(500).json({ error: "Failed to load sessions" }); }
});

app.get('/api/chat/:sessionId', async (req, res) => {
    try {
        const session = await ChatSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Not found" });
        res.json(session);
    } catch (err) { res.status(500).json({ error: "Failed to load history" }); }
});

// ==========================================
// AI TOOL FUNCTIONS
// ==========================================

async function handlePlaceOrderDB(username, productName, quantity) {
    if (!username) return "Error: Must log in to order.";

    //  ADB FEATURE 1 IN ACTION: Using the $text search index!
    const product = await Product.findOne({ $text: { $search: productName } });
    
    if (!product) return `Error: Item ${productName} not found.`;
    if (product.stockQuantity < quantity) return `Error: Only ${product.stockQuantity} left.`;

    //  ADB FEATURE 2: MONGODB TRANSACTIONS
    // Start a secure, isolated session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Step A: Deduct the stock (passing the session)
        product.stockQuantity -= quantity;
        await product.save({ session });

        // Step B: Create the Order (passing the session)
        const newOrder = new Order({
            customerName: username,
            items: [{ productName: product.name, quantity, price: product.price }],
            totalAmount: product.price * quantity,
            status: 'Paid & Processing'
        });
        await newOrder.save({ session });

        // Step C: If both succeeded, COMMIT the data permanently
        await session.commitTransaction();
        session.endSession();

        return `Success! Ordered ${quantity}x ${product.name}. Total: $${newOrder.totalAmount}.`;

    } catch (error) {
        // Step D: If ANYTHING failed, ABORT and roll back all changes!
        await session.abortTransaction();
        session.endSession();
        console.error("Transaction Aborted:", error);
        return "Critical Error: Order failed. No stock was deducted.";
    }
}

async function handleCheckOrdersDB(username) {
    if (!username) return "Error: Must log in.";
    const orders = await Order.find({ customerName: username });
    if (orders.length === 0) return "No past orders found.";

    return orders.map(o => {
        // Safely check if items exist before trying to read them to prevent crashes
        const itemName = (o.items && o.items.length > 0) ? o.items[0].productName : "Unknown Item";
        const itemQty = (o.items && o.items.length > 0) ? o.items[0].quantity : 1;

        return `- Order ID: ${o._id} | Items: ${itemQty}x ${itemName} | Total: $${o.totalAmount || 0} | Status: ${o.status || 'Unknown'}`;
    }).join('\n');
}

// ==========================================
// GEMINI CHAT ROUTE
// ==========================================
// ==========================================
// GEMINI CHAT ROUTE (BULLETPROOF)
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, username, sessionId } = req.body;
        if (!username) return res.status(401).json({ reply: "Please log in first." });

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ reply: "User database error." });

        let session = null;

        // Safely try to find the session
        if (sessionId) {
            session = await ChatSession.findById(sessionId);
        }

        // If the session was deleted, or we never had one, make a new one safely
        if (!session) {
            session = new ChatSession({
                userId: user._id,
                title: message.substring(0, 30) + "...",
                messages: []
            });
        }

        // Safely map the history for Gemini
        let historyForGemini = [];
        if (session.messages && session.messages.length > 0) {
            historyForGemini = session.messages.map(msg => ({
                role: msg.role === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));
        }

        session.messages.push({ role: 'user', content: message });

        const inventory = await Product.find({ isActive: true });
        const inventoryText = inventory.map(item => `- ${item.name}: $${item.price} (${item.stockQuantity} left)`).join('\n');

        const chatTools = [{
            functionDeclarations: [
                { name: "placeOrder", description: "Places order for user.", parameters: { type: "OBJECT", properties: { productName: { type: "STRING" }, quantity: { type: "NUMBER" } }, required: ["productName", "quantity"] } },
                { name: "checkMyOrders", description: "Retrieves past orders for user." } // Safely removed parameters requirement here
            ]
        }];

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `You are ServeBot. Current user: ${username}.
        \nInventory: \n${inventoryText}\n1. Use placeOrder to buy.
        \n2. Use checkMyOrders for history.
        \n3. Format data lists as Markdown tables.`,
            tools: chatTools
        });

        const chat = model.startChat({ history: historyForGemini });
        let result = await chat.sendMessage(message);

        const calls = result.response.functionCalls();
        if (calls && calls.length > 0) {
            const call = calls[0];
            let toolResultData = call.name === "placeOrder" ? await handlePlaceOrderDB(username, call.args.productName, call.args.quantity) : await handleCheckOrdersDB(username);
            result = await chat.sendMessage([{ functionResponse: { name: call.name, response: { result: toolResultData } } }]);
        }

        const finalReplyText = result.response.text();
        session.messages.push({ role: 'bot', content: finalReplyText });
        session.updatedAt = Date.now();
        await session.save();

        res.json({ reply: finalReplyText, sessionId: session._id });

    } catch (error) {
        // THIS WILL TELL US EXACTLY WHAT IS WRONG IN YOUR VS CODE TERMINAL
        console.error("🔥 CRITICAL CHAT API ERROR:", error);
        res.status(500).json({ reply: "Technical difficulties encountered. Check your VS Code terminal!" });
    }
});


app.listen(process.env.PORT || 3000, () => console.log('🚀 Server running!'));