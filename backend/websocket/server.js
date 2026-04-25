import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import Product from '../models/Product.js';

export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws'
  });

  const clients = new Map();
  console.log('✅ WebSocket server initialized');

  wss.on('connection', (ws, req) => {
    // --- Authentication ---
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.log('❌ Connection rejected: No token provided');
      ws.close(1008, 'No token provided');
      return;
    }

    let userId;
    try {
      // ✅ Using JWT_ACCESS_SECRET to match your .env
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      // ✅ Using decoded.id to match your token payload
      userId = decoded.id;
      
      if (!userId) {
        console.error('❌ Token valid but no user ID found in payload:', decoded);
        ws.close(1008, 'Invalid token payload');
        return;
      }
      
      console.log(`✅ Token verified for user: ${userId}`);
    } catch (err) {
      console.error('❌ Token verification failed:', err.message);
      ws.close(1008, 'Invalid token');
      return;
    }

    // Attach metadata to the WebSocket instance
    ws.userId = userId;
    ws.isAlive = true;

    // Store the connection
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    console.log(`🟢 User ${userId} connected. Total connections: ${wss.clients.size} | Unique users: ${clients.size}`);

    // --- Event Listeners ---
    ws.on('message', (data) => {
      console.log(`📩 Message from user ${userId}:`, data.toString());
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', (code, reason) => {
      const userConnections = clients.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          clients.delete(userId);
        }
      }
      console.log(`🔴 User ${userId} disconnected. Code: ${code} | Remaining: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error(`⚠️ WebSocket error for user ${userId}:`, err.message);
    });
  });

  // --- Heartbeat to detect dead connections ---
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log(`💀 Terminating dead connection for user ${ws.userId || 'unknown'}`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
    console.log('🔌 WebSocket server closed');
  });

  // --- Broadcasting Helpers ---
  function broadcastToAll(message) {
    const data = JSON.stringify(message);
    let sentCount = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.userId) {
        client.send(data);
        sentCount++;
      }
    });
    if (sentCount > 0) {
      console.log(`📢 Broadcasted "${message.type}" to ${sentCount} clients`);
    }
  }

  function sendToUser(userId, message) {
    const userConnections = clients.get(userId);
    if (userConnections) {
      const data = JSON.stringify(message);
      let sentCount = 0;
      userConnections.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
          sentCount++;
        }
      });
      console.log(`📨 Sent "${message.type}" to user ${userId} (${sentCount} connections)`);
    }
  }

  function broadcastStockUpdate(productId, changeType, productData) {
    const message = {
      type: 'STOCK_UPDATE',
      payload: {
        productId,
        change: changeType,
        product: productData,
        timestamp: new Date().toISOString()
      }
    };
    broadcastToAll(message);
  }

  async function broadcastLowStockAlert(productId) {
    try {
      const product = await Product.findById(productId);
      if (product && product.quantity < product.minStockLevel) {
        const message = {
          type: 'LOW_STOCK_ALERT',
          payload: {
            productId: product._id,
            productName: product.name,
            currentQuantity: product.quantity,
            minStockLevel: product.minStockLevel,
            timestamp: new Date().toISOString()
          }
        };
        broadcastToAll(message);
      }
    } catch (err) {
      console.error('Error fetching product for low stock alert:', err);
    }
  }

  // Return public API
  return {
    broadcastToAll,
    sendToUser,
    broadcastStockUpdate,
    broadcastLowStockAlert
  };
}