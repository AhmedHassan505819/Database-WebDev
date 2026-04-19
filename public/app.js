let currentUser = null;
let isLoginMode = true;

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// Swaps the UI between "Login" and "Register"
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

// 2. AUTHENTICATION LOGIC

async function handleAuth() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const email = document.getElementById('auth-email').value.trim();

    if (!username || !password || (!isLoginMode && !email)) {
        alert("Please fill in all fields.");
        return;
    }

    // Determine the API endpoint based on what mode we are in
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    
    // We will build this backend route in the next step!
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });

        const data = await res.json();

        if (res.ok) {
            // Success! Save the user and switch to the chat screen
            currentUser = data.user;
            playWelcomeAnimation(currentUser.username);
            
            // If they are an admin, un-hide the Admin Portal button
            if (currentUser.role === 'admin') {
                document.getElementById('go-admin-btn').classList.remove('hidden');
            } else {
                document.getElementById('go-admin-btn').classList.add('hidden');
            }

            switchView('chat-view');
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
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-email').value = '';
    
    // NEW: Force the admin button to hide when logging out
    document.getElementById('go-admin-btn').classList.add('hidden');
    
    // Also clear the chat history so the next person has a fresh screen
    document.getElementById('chat-box').innerHTML = ''; 
    
    switchView('auth-view');
}

// 3. CHAT LOGIC (Using User Context)

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

function addMessage(text, isUser) {
    const div = document.createElement('div');
    div.className = `message slide-up ${isUser ? 'user-message' : 'bot-message'}`;
    div.textContent = text;
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
            // We now send the username to the AI so it knows who is talking!
            body: JSON.stringify({ message: text, username: currentUser.username })
        });
        const data = await res.json();
        addMessage(data.reply, false);
    } catch (err) {
        addMessage("Server Connection Error", false);
    }
}

sendBtn.onclick = handleChat;
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChat();
});





// ==========================================
// 4. ADMIN DASHBOARD LOGIC
// ==========================================

// Fetch and display all inventory in the Admin Dashboard
async function fetchInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '<h3 style="color: white;">Loading live database...</h3>';
    
    try {
        const res = await fetch('/api/inventory');
        const products = await res.json();
        
        grid.innerHTML = ""; 

        products.forEach(item => {
            // Use your requested badge styles
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
fetchInventory(); // Load inventory when admin view is opened

// Update the stock and price of an existing product
async function updateProduct(productId) {
    const newQty = document.getElementById(`qty-${productId}`).value;
    const newPrice = document.getElementById(`price-${productId}`).value;

    try {
        const res = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stockQuantity: newQty, price: newPrice })
        });

        if (res.ok) {
            // Automatically refresh the grid to update the badges
            fetchInventory();
        } else {
            alert("Failed to update product.");
        }
    } catch (err) {
        alert("Server Error");
    }
}

// Add a new product from the Admin Panel
async function addNewProduct() {
    const name = document.getElementById('new-item-name').value.trim();
    const price = document.getElementById('new-item-price').value.trim();
    const qty = document.getElementById('new-item-qty').value.trim();

    if (!name || !price || !qty) {
        alert("Please fill in all product fields.");
        return;
    }

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price, stockQuantity: qty })
        });

        if (res.ok) {
            // Clear inputs
            document.getElementById('new-item-name').value = '';
            document.getElementById('new-item-price').value = '';
            document.getElementById('new-item-qty').value = '';
            // Refresh the grid to show the new item!
            fetchInventory();
        } else {
            alert("Failed to add product.");
        }
    } catch (err) {
        alert("Server Error");
    }
}





// Function for the Typewriter Effect
function playWelcomeAnimation(username) {
    const banner = document.getElementById('welcome-banner');
    const text = `Hello, ${username}`;
    banner.innerHTML = '';
    banner.style.opacity = '1'; // Ensure it's fully visible
    
    let i = 0;
    const speed = 400; // Milliseconds per letter

    function typeWriter() {
        if (i < text.length) {
            banner.innerHTML += text.charAt(i);
            i++;
            setTimeout(typeWriter, speed);
        } else {
            // Once typing is done, wait 6 seconds (6000ms), then fade out
            setTimeout(() => {
                banner.style.opacity = '0';
            }, 10000);
        }
    }
    
    typeWriter(); // Start typing!
}



// ==========================================
// BACKGROUND PARTICLE & MOUSE EFFECTS
// ==========================================
const particlesContainer = document.getElementById('particles-container');

// 1. Create floating background particles
function initParticles() {
    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 2 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particlesContainer.appendChild(particle);
        animateParticle(particle);
    }
}

function animateParticle(particle) {
    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    particle.style.left = `${startX}%`;
    particle.style.top = `${startY}%`;
    particle.style.opacity = '0';
    
    const duration = Math.random() * 10 + 10;
    const delay = Math.random() * 5;
    
    setTimeout(() => {
        particle.style.transition = `all ${duration}s linear`;
        particle.style.opacity = Math.random() * 0.3 + 0.1;
        particle.style.left = `${startX + (Math.random() * 20 - 10)}%`;
        particle.style.top = `${startY - Math.random() * 20}%`;
        
        setTimeout(() => { animateParticle(particle); }, duration * 1000);
    }, delay * 1000);
}

initParticles();

// 2. Mouse interaction: Trail and Sphere movement
document.addEventListener('mousemove', (e) => {
    // Create subtle trail particle
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = Math.random() * 3 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${(e.clientX / window.innerWidth) * 100}%`;
    particle.style.top = `${(e.clientY / window.innerHeight) * 100}%`;
    particle.style.opacity = '0.4';
    particlesContainer.appendChild(particle);
    
    setTimeout(() => {
        particle.style.transition = 'all 1.5s ease-out';
        particle.style.transform = `translate(${Math.random() * 40 - 20}px, ${Math.random() * 40 - 20}px)`;
        particle.style.opacity = '0';
        setTimeout(() => particle.remove(), 1500);
    }, 10);
    
    // Parallax effect on the gradient spheres
    const spheres = document.querySelectorAll('.gradient-sphere');
    const moveX = (e.clientX / window.innerWidth - 0.5) * 15;
    const moveY = (e.clientY / window.innerHeight - 0.5) * 15;
    
    spheres.forEach((sphere, index) => {
        const speed = index + 1; // Different speeds for depth
        sphere.style.transform = `translate(${moveX * speed}px, ${moveY * speed}px)`;
    });
});