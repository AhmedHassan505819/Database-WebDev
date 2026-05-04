// ==========================================
// 1. GLOBAL VARIABLES & UI SWITCHING
// ==========================================
let currentUser = null;
let isLoginMode = true;
let currentSessionId = null;

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const emailInput = document.getElementById('auth-email');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const actionBtn = document.getElementById('auth-action-btn');
    const toggleText = document.querySelector('.toggle-text');

    if (isLoginMode) {
        emailInput.classList.add('hidden');
        title.textContent = "Welcome Back";
        subtitle.textContent = "Sign in to track your orders.";
        actionBtn.textContent = "Sign In";
        toggleText.innerHTML = 'New here? <span onclick="toggleAuthMode()">Register</span>';
    } else {
        emailInput.classList.remove('hidden');
        title.textContent = "Create Account";
        subtitle.textContent = "Join us to start shopping.";
        actionBtn.textContent = "Sign Up";
        toggleText.innerHTML = 'Already have an account? <span onclick="toggleAuthMode()">Sign In</span>';
    }
}

// ==========================================
// 2. AUTHENTICATION & INTRO SEQUENCE
// ==========================================
async function handleAuth() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const email = document.getElementById('auth-email').value.trim();

    if (!username || !password || (!isLoginMode && !email)) {
        alert("Please fill in all fields.");
        return;
    }

    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });

        const data = await res.json();

        if (res.ok) {
            currentUser = data.user;
            
            if (currentUser.role === 'admin') {
                document.getElementById('go-admin-btn').classList.remove('hidden');
            } else {
                document.getElementById('go-admin-btn').classList.add('hidden');
            }

            // Start the cinematic Intro instead of going straight to chat
            startIntroSequence(currentUser.username);
        } else {
            alert(data.error || "Authentication failed");
        }
    } catch (err) {
        console.error(err);
        alert("Server connection error.");
    }
}

function logout() {
    currentUser = null;
    currentSessionId = null;
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-email').value = '';
    document.getElementById('go-admin-btn').classList.add('hidden');
    chatBox.innerHTML = ''; 
    switchView('auth-view');
}

// THE TYPEWRITER INTRO LOGIC
let introActive = false;
let introTimeout;

function startIntroSequence(username) {
    switchView('intro-view');
    introActive = true;
    
    const text = `Initializing system...\nWelcome back, ${username}.\nConnecting to ServeBot AI Core...\nLoading secure protocols...\nAccess Granted.`;
    const container = document.getElementById('intro-text');
    container.innerHTML = '';
    
    let i = 0;

    function type() {
        if (!introActive) return; // Stop if user skipped
        if (i < text.length) {
            // Handle line breaks properly
            if (text.charAt(i) === '\n') {
                container.innerHTML += '<br><br>';
            } else {
                container.innerHTML += text.charAt(i);
            }
            i++;
            introTimeout = setTimeout(type, 40); // Typing speed
        } else {
            // Wait 1.5 seconds after finishing, then go to chat
            introTimeout = setTimeout(endIntro, 1500); 
        }
    }
    type();
}

// Ends the intro and loads the actual chat
function endIntro() {
    if (!introActive) return;
    introActive = false;
    switchView('chat-view');
    loadChatHistory(); // Load sidebar history 
}

// Listen for "Enter" key to skip the intro
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && introActive) {
        clearTimeout(introTimeout);
        endIntro();
    }
});


// ==========================================
// 3. CHAT LOGIC & MARKDOWN
// ==========================================
function addMessage(text, isUser) {
    const div = document.createElement('div');
    div.className = `message slide-up ${isUser ? 'user-message' : 'bot-message'}`;
    
    if (isUser) {
        div.textContent = text; 
    } else {
        div.innerHTML = text; 
    }
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function handleChat() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, true);
    userInput.value = '';

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text, 
                username: currentUser.username,
                sessionId: currentSessionId
            })
        });
        
        const data = await res.json();
        
        if (data.sessionId && !currentSessionId) {
            currentSessionId = data.sessionId;
            loadChatHistory(); 
        } else if (data.sessionId) {
            currentSessionId = data.sessionId;
        }

        const formattedHTML = marked.parse(data.reply);
        addMessage(formattedHTML, false);
    } catch (err) {
        addMessage("Server Connection Error", false);
    }
}

sendBtn.onclick = handleChat;
userInput.addEventListener('keypress', (e) => {
    // Only trigger chat if we aren't in the intro screen!
    if (e.key === 'Enter' && !introActive) handleChat();
});


// ==========================================
// 4. CHAT HISTORY (SIDEBAR & DELETION)
// ==========================================
function startNewChat() {
    chatBox.innerHTML = '';
    currentSessionId = null; 
    
    const greetingDiv = document.createElement('div');
    greetingDiv.className = 'message bot-message slide-up';
    greetingDiv.textContent = 'Welcome to a new chat! How can I help you today?';
    chatBox.appendChild(greetingDiv);
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.style.background = 'rgba(0, 0, 0, 0.2)';
        item.style.border = '1px solid transparent';
    });

    const list = document.getElementById('history-list');
    const tempItem = document.createElement('div');
    tempItem.className = 'history-item';
    tempItem.style.background = 'rgba(216, 27, 96, 0.3)'; 
    tempItem.style.border = '1px solid var(--primary-color)';
    tempItem.innerHTML = `<span class="history-title">New Conversation...</span>`;
    list.prepend(tempItem);
}

async function loadChatHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    try {
        const res = await fetch(`/api/sessions/${currentUser.username}`);
        const sessions = await res.json();

        sessions.forEach(session => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            // Build the layout with the title and the delete button
            item.innerHTML = `
                <span class="history-title">${session.title}</span>
                <button class="delete-btn" onclick="deleteSession('${session._id}', event)">✖</button>
            `;

            if (session._id === currentSessionId) {
                item.style.background = 'rgba(216, 27, 96, 0.3)';
                item.style.border = '1px solid var(--primary-color)';
            }
            
            // Make the whole box clickable (except the delete button)
            item.onclick = (e) => loadSpecificSession(session._id, e);
            list.appendChild(item);
        });

        if (sessions.length > 0 && !currentSessionId) {
            loadSpecificSession(sessions[0]._id);
        } else if (sessions.length === 0) {
            startNewChat();
        }
    } catch (err) {
        console.error("History failed to load", err);
    }
}

async function loadSpecificSession(sessionId, event) {
    currentSessionId = sessionId;
    chatBox.innerHTML = ''; 
    addMessage("Loading conversation...", false);
    
    document.querySelectorAll('.history-item').forEach(el => {
        el.style.background = 'rgba(0, 0, 0, 0.2)';
        el.style.border = '1px solid transparent';
    });
    
    if (event && event.currentTarget) {
        event.currentTarget.style.background = 'rgba(216, 27, 96, 0.3)';
        event.currentTarget.style.border = '1px solid var(--primary-color)';
    }

    try {
        const res = await fetch(`/api/chat/${sessionId}`);
        const sessionData = await res.json();
        chatBox.innerHTML = ''; 
        
        if (sessionData.messages && sessionData.messages.length > 0) {
            sessionData.messages.forEach(msg => {
                const isUser = msg.role === 'user';
                const div = document.createElement('div');
                div.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
                
                if (isUser) {
                    div.textContent = msg.content;
                } else {
                    div.innerHTML = marked.parse(msg.content);
                }
                chatBox.appendChild(div);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        } else {
            addMessage("This is an empty conversation.", false);
        }
    } catch (err) {
        chatBox.innerHTML = '';
        addMessage("Error loading this conversation from the database.", false);
    }
}

// DELETE A CHAT FROM THE DATABASE
async function deleteSession(sessionId, event) {
    event.stopPropagation(); // Prevents the click from loading the chat behind the button
    
    // Add a quick confirmation popup
    if (!confirm("Are you sure you want to delete this conversation?")) return;

    try {
        const res = await fetch(`/api/chat/${sessionId}`, { method: 'DELETE' });
        
        if (res.ok) {
            // If they deleted the chat they are currently looking at, wipe the screen
            if (currentSessionId === sessionId) {
                startNewChat(); 
            }
            // Refresh the sidebar
            loadChatHistory();
        } else {
            alert("Failed to delete chat.");
        }
    } catch (err) {
        alert("Server error. Could not delete.");
    }
}


// ==========================================
// 5. ADMIN DASHBOARD
// ==========================================
async function fetchInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '<h3 style="color: white;">Loading live database...</h3>';
    
    try {
        const res = await fetch('/api/inventory', { cache: 'no-store' });
        const products = await res.json();
        grid.innerHTML = ""; 

        products.forEach(item => {
            const stockClass = item.stockQuantity > 0 ? 'stock-badge' : 'stock-badge out-of-stock';
            const stockText = item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : 'Out of Stock';

            const card = document.createElement('div');
            card.className = 'inventory-card slide-up';
            card.innerHTML = `
                <h3>${item.name}</h3>
                <span class="${stockClass}">${stockText}</span>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="font-size: 0.9rem; color: var(--text-muted);">Price ($):</label>
                        <input type="number" id="price-${item._id}" class="edit-input" value="${item.price}">
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="font-size: 0.9rem; color: var(--text-muted);">Qty:</label>
                        <input type="number" id="qty-${item._id}" class="edit-input" value="${item.stockQuantity}">
                    </div>
                    <button onclick="updateProduct('${item._id}')" class="action-btn" style="width: 100%; margin-top: 10px;">Update</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = '<h3 style="color:red;">Error loading inventory.</h3>';
    }
}

async function updateProduct(productId) {
    const newQty = document.getElementById(`qty-${productId}`).value;
    const newPrice = document.getElementById(`price-${productId}`).value;

    try {
        const res = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stockQuantity: newQty, price: newPrice })
        });

        if (res.ok) fetchInventory();
        else alert("Failed to update product.");
    } catch (err) { alert("Server Error"); }
}

async function addNewProduct() {
    const name = document.getElementById('new-item-name').value.trim();
    const price = document.getElementById('new-item-price').value.trim();
    const qty = document.getElementById('new-item-qty').value.trim();

    if (!name || !price || !qty) return alert("Please fill in all product fields.");

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price, stockQuantity: qty })
        });

        if (res.ok) {
            document.getElementById('new-item-name').value = '';
            document.getElementById('new-item-price').value = '';
            document.getElementById('new-item-qty').value = '';
            fetchInventory();
        } else alert("Failed to add product.");
    } catch (err) { alert("Server Error"); }
}

// ==========================================
// 6. GLITTER CANVAS & PARALLAX BACKGROUND
// ==========================================
document.addEventListener('mousemove', (e) => {
    const spheres = document.querySelectorAll('.gradient-sphere');
    const moveX = (e.clientX / window.innerWidth - 0.5) * 15;
    const moveY = (e.clientY / window.innerHeight - 0.5) * 15;
    
    spheres.forEach((sphere, index) => {
        sphere.style.transform = `translate(${moveX * (index + 1)}px, ${moveY * (index + 1)}px)`;
    });
});

// Canvas Glitter Engine (Ported from Landing Page)
const canvas = document.getElementById('glitter-canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
const mouse = { x: null, y: null };

window.addEventListener('mousemove', function(event) {
    mouse.x = event.x;
    mouse.y = event.y;
    for (let i = 0; i < 2; i++) {
        particlesArray.push(new Particle());
    }
});

window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

class Particle {
    constructor() {
        this.x = mouse.x;
        this.y = mouse.y;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 1.5 - 0.75;
        this.speedY = Math.random() * 1.5 - 0.75;
        const colors = [
            'rgba(255, 255, 255, 0.4)', 
            'rgba(216, 27, 96, 0.15)', 
            'rgba(142, 36, 170, 0.15)'
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.size > 0.1) this.size -= 0.03;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.color;
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
        
        if (particlesArray[i].size <= 0.1) {
            particlesArray.splice(i, 1);
            i--;
        }
    }
    requestAnimationFrame(animate);
}
animate();

// ==========================================
// 7. ADMIN ANALYTICS (CHART.JS)
// ==========================================
let adminChart = null; // Keep track of the chart so we can destroy/redraw it

async function loadAnalytics() {
    try {
        const res = await fetch('/api/analytics');
        const data = await res.json();

        // Update the big numbers
        document.getElementById('total-revenue-stat').textContent = `$${data.totalRevenue}`;
        document.getElementById('total-orders-stat').textContent = data.totalOrders;

        // Prepare data for the Chart
        const labels = data.topCustomers.map(c => c.name);
        const totals = data.topCustomers.map(c => c.total);

        const ctx = document.getElementById('topCustomersChart').getContext('2d');

        // Destroy the old chart if it exists so it doesn't overlap
        if (adminChart) adminChart.destroy();

        // Draw the new glowing chart!
        adminChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Spent ($)',
                    data: totals,
                    backgroundColor: 'rgba(216, 27, 96, 0.6)', // Pink
                    borderColor: 'rgba(216, 27, 96, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    hoverBackgroundColor: 'rgba(142, 36, 170, 0.8)' // Purple
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: '#f8fafc',
                plugins: {
                    legend: { labels: { color: '#f8fafc' } },
                    title: {
                        display: true,
                        text: 'Top 5 Customers',
                        color: '#f8fafc',
                        font: { size: 16 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#a1a1aa' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a1a1aa' }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Failed to load analytics");
    }
}