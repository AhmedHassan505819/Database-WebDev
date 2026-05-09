const mongoose = require('mongoose');

// 🔥 ADB FEATURE 3: AUDIT LOGGING
// This schema acts as an immutable ledger. It records exactly
// what changed, when it changed, and what the old values were.
const AuditSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., "PRICE_UPDATE"
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    oldValue: Number,
    newValue: Number,
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', AuditSchema);