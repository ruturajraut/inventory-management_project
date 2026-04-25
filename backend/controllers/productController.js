import Product from '../models/Product.js';

// @desc    Create new product
// @route   POST /api/products
// @access  Private (requires authentication)
export const createProduct = async (req, res) => {
  try {
    const { name, description, sku, category, price, quantity, minStockLevel, supplier, imageUrl } = req.body;

    // Check if SKU already exists
    const skuExists = await Product.findOne({ sku: sku.toUpperCase() });

    if (skuExists) {
      return res.status(400).json({
        success: false,
        message: `Product with SKU "${sku.toUpperCase()}" already exists`
      });
    }

    // Create product with user ID from auth middleware
    const product = await Product.create({
      name,
      description,
      sku: sku.toUpperCase(),
      category,
      price,
      quantity,
      minStockLevel,
      supplier,
      imageUrl,
      user: req.user._id
    });

    // Populate user details
    await product.populate('user', 'name email');

    // ✅ WEBSOCKET: Broadcast new product to all connected clients
    const wss = req.app.locals.wss;
    if (wss) {
      wss.broadcastStockUpdate(product._id, 'CREATED', product);
      
      // Check if new product is already low stock
      if (product.quantity < product.minStockLevel) {
        wss.broadcastLowStockAlert(product._id);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all products for authenticated user
// @route   GET /api/products
// @access  Private (requires authentication)
export const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = '-createdAt',
      category,
      search,
      lowStock,
      minPrice,
      maxPrice
    } = req.query;

    const filter = { user: req.user._id };

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }

    if (lowStock === 'true') {
      filter.$expr = {
        $lt: ['$quantity', '$minStockLevel']
      };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let sortOption = {};
    if (sort === 'name') sortOption = { name: 1 };
    else if (sort === '-name') sortOption = { name: -1 };
    else if (sort === 'price') sortOption = { price: 1 };
    else if (sort === '-price') sortOption = { price: -1 };
    else if (sort === 'quantity') sortOption = { quantity: 1 };
    else if (sort === '-quantity') sortOption = { quantity: -1 };
    else if (sort === 'createdAt') sortOption = { createdAt: 1 };
    else if (sort === '-createdAt') sortOption = { createdAt: -1 };
    else if (sort === 'updatedAt') sortOption = { updatedAt: 1 };
    else if (sort === '-updatedAt') sortOption = { updatedAt: -1 };
    else sortOption = { createdAt: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name email'),
      Product.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      },
      filters: {
        category: category || null,
        search: search || null,
        lowStock: lowStock === 'true' || false,
        minPrice: minPrice || null,
        maxPrice: maxPrice || null
      },
      sorting: {
        field: sort.replace(/^-/, ''),
        order: sort.startsWith('-') ? 'desc' : 'asc'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('user', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (req.body.sku && req.body.sku !== product.sku) {
      const skuExists = await Product.findOne({
        sku: req.body.sku.toUpperCase(),
        user: req.user._id,
        _id: { $ne: req.params.id }
      });

      if (skuExists) {
        return res.status(400).json({
          success: false,
          message: `Product with SKU "${req.body.sku.toUpperCase()}" already exists`
        });
      }
      req.body.sku = req.body.sku.toUpperCase();
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    // ✅ WEBSOCKET: Broadcast updated product to all connected clients
    const wss = req.app.locals.wss;
    if (wss) {
      wss.broadcastStockUpdate(updatedProduct._id, 'UPDATED', updatedProduct);
      
      // Check if product is now low on stock
      if (updatedProduct.quantity < updatedProduct.minStockLevel) {
        wss.broadcastLowStockAlert(updatedProduct._id);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.deleteOne();

    // ✅ WEBSOCKET: Broadcast deleted product to all connected clients
    const wss = req.app.locals.wss;
    if (wss) {
      wss.broadcastStockUpdate(req.params.id, 'DELETED', { _id: req.params.id });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get low stock products only
// @route   GET /api/products/low-stock
// @access  Private
export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      user: req.user._id,
      $expr: {
        $lt: ['$quantity', '$minStockLevel']
      }
    }).sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get inventory summary stats
// @route   GET /api/products/stats/summary
// @access  Private
export const getInventoryStats = async (req, res) => {
  try {
    const products = await Product.find({ user: req.user._id });

    const stats = {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + (p.price * p.quantity), 0),
      lowStockCount: products.filter(p => p.quantity < p.minStockLevel).length,
      outOfStockCount: products.filter(p => p.quantity === 0).length,
      categories: {},
      totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
      averagePrice: 0
    };

    if (stats.totalProducts > 0) {
      stats.averagePrice = products.reduce((sum, p) => sum + p.price, 0) / stats.totalProducts;
    }

    products.forEach(product => {
      stats.categories[product.category] = (stats.categories[product.category] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};