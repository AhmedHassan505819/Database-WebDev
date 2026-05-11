const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        default: "New Conversation" 
    },
    messages: [
        {
            role: { type: String, enum: ['user', 'bot'] },
            content: { type: String },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// 🔥 ADB FEATURE 1: Mongoose Middleware (Pre-Save Hook)
// This guarantees that every time you push a new message to the array 
// and call .save(), the database automatically refreshes the updatedAt clock.
chatSessionSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

// 🔥 ADB FEATURE 2: Data Lifecycle Management (TTL Index)
// MongoDB runs a background thread that automatically deletes this document
// 604,800 seconds (7 days) after its last 'updatedAt' timestamp.
chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);