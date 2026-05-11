const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    // Bonus Constraint: Native Mongoose validation to prevent negative prices
    price: { type: Number, required: true, min: 0 }, 
    stockQuantity: { type: Number, required: true },
    category: { type: String, default: "General" },
    isDeleted: { type: Boolean, default: false }
});

// ADB FEATURE 1: FULL-TEXT INDEXING
// This tells MongoDB to create an inverted index for the name field,
// making searches incredibly fast compared to normal Regex scans.
ProductSchema.index({ name: 'text', category: 'text' });

// ADB FEATURE 2: SCHEMA-LEVEL INTEGRITY (Pre-Save Middleware)
// This runs automatically right before product.save() is called anywhere in your app.
// It physically prevents the database from writing a negative stock value.
ProductSchema.pre('save', function() {
    if (this.stockQuantity < 0) {
        // This instantly aborts the save and throws the error directly to your catch block!
        throw new Error(`Database Constraint Violation: Insufficient stock for ${this.name}.`);
    }
});




module.exports = mongoose.model('Product', ProductSchema);