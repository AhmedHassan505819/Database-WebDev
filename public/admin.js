// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const inventoryGrid = document.getElementById('inventory-grid');

// Hardcoded mock credentials for the project
const ADMIN_USER = "admin";
const ADMIN_PASS = "1234";

// Handle Login
document.getElementById('login-btn').addEventListener('click', () => {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        // Swap faces
        loginView.classList.remove('view-active');
        loginView.classList.add('view-hidden');
        
        dashboardView.classList.remove('view-hidden');
        dashboardView.classList.add('view-active');
        
        // Fetch the data from MongoDB
        fetchInventory();
    } else {
        alert("Invalid Credentials!");
    }
});

// Handle Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    dashboardView.classList.remove('view-active');
    dashboardView.classList.add('view-hidden');
    
    loginView.classList.remove('view-hidden');
    loginView.classList.add('view-active');
    
    document.getElementById('admin-user').value = '';
    document.getElementById('admin-pass').value = '';
});

// Fetch Data from Backend
async function fetchInventory() {
    try {
        inventoryGrid.innerHTML = '<h3>Loading database...</h3>';
        
        // Call the new Express route we just built
        const response = await fetch('/api/inventory');
        const products = await response.json();
        
        // Clear loading text
        inventoryGrid.innerHTML = '';

        // Loop through the MongoDB data and create HTML cards
        products.forEach(item => {
            const stockClass = item.stockQuantity > 0 ? 'stock-badge' : 'stock-badge out-of-stock';
            const stockText = item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : 'Out of Stock';

            const card = document.createElement('div');
            card.className = 'inventory-card slide-up';
            card.innerHTML = `
                <h3>${item.name}</h3>
                <p>Category: ${item.category || 'General'}</p>
                <h2>$${item.price.toFixed(2)}</h2>
                <span class="${stockClass}">${stockText}</span>
            `;
            inventoryGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Failed to load inventory:", error);
        inventoryGrid.innerHTML = '<h3 style="color:red;">Error connecting to database.</h3>';
    }
}