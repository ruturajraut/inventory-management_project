import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,  // ← This creates index automatically
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-]+$/, 'SKU can only contain letters, numbers, and hyphens']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Electronics', 'Furniture', 'Clothing', 'Food', 'Books', 'Toys', 'Sports', 'Other'],
        message: '{VALUE} is not a valid category'
      }
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      validate: {
        validator: function(value) {
          return value >= 0;
        },
        message: 'Price must be a positive number'
      }
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number'
      }
    },
    minStockLevel: {
      type: Number,
      default: 10,
      min: [0, 'Minimum stock level cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Minimum stock level must be a whole number'
      }
    },
    supplier: {
      type: String,
      trim: true,
      maxlength: [100, 'Supplier name cannot exceed 100 characters']
    },
    imageUrl: {
      type: String,
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Product must belong to a user']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
// productSchema.index({ sku: 1 });  ← REMOVE THIS LINE (already indexed by unique: true)
productSchema.index({ category: 1 });
productSchema.index({ user: 1 });
productSchema.index({ name: 'text', description: 'text' });

// Virtual property - Check if product is low on stock
productSchema.virtual('isLowStock').get(function() {
  return this.quantity < this.minStockLevel;
});

// Virtual property - Calculate total inventory value
productSchema.virtual('totalValue').get(function() {
  return this.price * this.quantity;
});

// Virtual property - Stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.quantity === 0) {
    return 'Out of Stock';
  } else if (this.quantity < this.minStockLevel) {
    return 'Low Stock';
  } else {
    return 'In Stock';
  }
});

const Product = mongoose.model('Product', productSchema);

export default Product;