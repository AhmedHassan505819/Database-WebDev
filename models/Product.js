const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stockQuantity: { type: Number, required: true },
    category: { type: String, default: "General" }
});

// 🔥 ADB FEATURE 1: FULL-TEXT INDEXING
// This tells MongoDB to create an inverted index for the name field,
// making searches incredibly fast compared to normal Regex scans.
ProductSchema.index({ name: 'text', category: 'text' });

module.exports = mongoose.model('Product', ProductSchema);