require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to Database for seeding...'))
  .catch(err => console.error(err));

const dummyProducts = [
  { name: "Wireless Noise-Canceling Headphones", price: 199.99, stockQuantity: 15, category: "Audio" },
  { name: "Mechanical Gaming Keyboard", price: 129.50, stockQuantity: 8, category: "Accessories" },
  { name: "Ergonomic Office Chair", price: 249.00, stockQuantity: 0, category: "Furniture" } // Notice this is out of stock!
];

async function seedDatabase() {
  try {
    await Product.deleteMany({}); // Clear the collection first
    await Product.insertMany(dummyProducts);
    console.log('✅ Database successfully seeded with fresh dummy products!');
  } catch (error) {
    console.error('Failed to seed:', error);
  } finally {
    mongoose.connection.close(); // Close the connection so the script ends
  }
}

seedDatabase();