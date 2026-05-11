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
app.get('/login', (req, res) => res.sendFile(__dirname + '/public/chat.html'));

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
    try { res.json(await Product.find({ isDeleted: { $ne: true } })); }
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

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // 1. Store the old values securely BEFORE we change them
    const oldPrice = product.price;
    const oldQty = product.stockQuantity;

    // 2. Apply the new values to the product
    product.price = newPrice;
    product.stockQuantity = newQty;

    // 3. THE FIX: Attempt to save the product FIRST. 
    // If you type a negative number, the Pre-Save Hook will throw an error 
    // right here, and the code will immediately jump to the catch block!
    await product.save();

    // 4. If we made it this far, the save was 100% successful. 
    // NOW it is safe to write to the permanent Audit Ledger.
    if (oldPrice !== newPrice) {
        await AuditLog.create({
            action: "PRICE_CHANGE",
            productId: product._id,
            productName: product.name,
            oldValue: oldPrice,
            newValue: newPrice
        });
    }

    if (oldQty !== newQty) {
        await AuditLog.create({
            action: "MANUAL_STOCK_OVERRIDE", 
            productId: product._id,
            productName: product.name,
            oldValue: oldQty,
            newValue: newQty
        });
    }

    res.json({ message: "Success - Product updated and audited." });
  } catch (error) { 
      // If the save failed, the Audit Logs are never written. Clean and safe!
      console.error("🔥 CRITICAL UPDATE ERROR:", error); 
      res.status(500).json({ error: "Failed to update." }); 
  }
});

// ==========================================
// ADMIN API: SOFT DELETE A PRODUCT
// ==========================================
app.delete('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;

        // 🔥 ADB FEATURE: Soft Delete Execution
        // Instead of destroying the data, we just flip the boolean flag.
        // Because of our middleware, this item will instantly vanish from the UI.
        const deletedProduct = await Product.findByIdAndUpdate(
            productId, 
            { isDeleted: true }, 
            { new: true } // Returns the updated document
        );

        if (!deletedProduct) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Optional: Audit log that an admin removed this item!
        
        await AuditLog.create({
            action: "PRODUCT_SOFT_DELETED",
            productId: deletedProduct._id,
            productName: deletedProduct.name
        });
        

        res.json({ message: `${deletedProduct.name} successfully removed from active inventory.` });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Failed to delete product." });
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

   const product = await Product.findOne({ 
        $text: { $search: productName },
        isDeleted: { $ne: true }
    });
    
    if (!product) return `Error: Item ${productName} not found.`;
    if (product.stockQuantity < quantity) return `Error: Only ${product.stockQuantity} left.`;

    try {
        // Step A: Deduct the stock
        product.stockQuantity -= quantity;
        await product.save();

        // Step B: Create the Order
        const newOrder = new Order({
            customerName: username,
            items: [{ productName: product.name, quantity, price: product.price }],
            totalAmount: product.price * quantity,
            status: 'Paid & Processing'
        });
        await newOrder.save();

        return `Success! Ordered ${quantity}x ${product.name}. Total: $${newOrder.totalAmount}.`;

    } catch (error) {
        console.error("Order Error:", error);
        return "Critical Error: Order failed. Please try again.";
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

        const inventory = await Product.find({ isDeleted: { $ne: true } });
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