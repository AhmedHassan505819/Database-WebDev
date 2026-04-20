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

module.exports = mongoose.model('ChatSession', chatSessionSchema);