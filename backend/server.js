// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import connectDB from './config/db.js';
// import mongoose from 'mongoose';  // ← Add this
// import authRoutes from './routes/authRoutes.js';
// import productRoutes from './routes/productRoutes.js';  // ← Add this

// dotenv.config();
// connectDB();

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use('/api/auth', authRoutes);

// //for testing
// import Product from './models/Product.js';  // ← Add this



// // Test route
// app.get('/', (req, res) => {
//   res.json({
//     success: true,
//     message: 'Welcome to Inventory Management API'
//   });
// });

// app.use('/api/products', productRoutes);  // ← Add this

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`✅ Server is running on port ${PORT}`);
//   console.log(`📍 Visit: http://localhost:${PORT}`);
// });

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';                          // ← ADD THIS
import connectDB from './config/db.js';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import Product from './models/Product.js';
import { setupWebSocketServer } from './websocket/server.js';  // ← ADD THIS

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Inventory Management API'
  });
});

// ✅ STEP 1: Create HTTP server from Express app
const server = http.createServer(app);

// ✅ STEP 2: Attach WebSocket server to HTTP server
const wssFunctions = setupWebSocketServer(server);

// ✅ STEP 3: Make WebSocket functions available to controllers
app.locals.wss = wssFunctions;

// ✅ STEP 4: Export for use in controllers
export { wssFunctions };

// ✅ STEP 5: Start the HTTP server (not app.listen)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Visit: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
});