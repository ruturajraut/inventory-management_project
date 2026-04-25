import { verifyAccessToken } from '../utils/generateToken.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = verifyAccessToken(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, token invalid or expired'
        });
      }

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password -refreshTokens');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      next(); // Continue to next middleware/controller

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};