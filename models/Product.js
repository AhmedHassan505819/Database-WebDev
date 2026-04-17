const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  stockQuantity: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  category: { 
    type: String 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
});

module.exports = mongoose.model('Product', productSchema);