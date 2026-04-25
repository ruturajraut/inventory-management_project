import express from 'express';
import { 
  createProduct, 
  getAllProducts, 
  getProductById, 
  updateProduct, 
  deleteProduct,
  getLowStockProducts,
  getInventoryStats
} from '../controllers/productController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

// Stats routes (must be before /:id routes)
router.get('/stats/summary', getInventoryStats);
router.get('/low-stock', getLowStockProducts);

// Main CRUD routes
router.route('/')
  .post(createProduct)
  .get(getAllProducts);

router.route('/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

export default router;