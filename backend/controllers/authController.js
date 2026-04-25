import User from '../models/User.js';
import { 
  generateAccessToken, 
  generateRefreshToken,
  verifyRefreshToken
} from '../utils/generateToken.js';


export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log('📝 Register attempt:', { name, email }); // Debug log

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    console.log('✅ Email available, creating user...'); // Debug log

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    console.log('✅ User created:', user._id); // Debug log

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    console.log('✅ Tokens generated'); // Debug log

    // Save refresh token to database
    await User.updateOne(
      { _id: user._id },
      { $push: { refreshTokens: refreshToken } }
    );

    console.log('✅ Refresh token saved'); // Debug log

    // Send response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error); // Debug log
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
// export const registerUser = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // Check if user already exists
//     const userExists = await User.findOne({ email });

//     if (userExists) {
//       return res.status(400).json({
//         success: false,
//         message: 'User with this email already exists'
//       });
//     }

//     // Create user
//     const user = await User.create({
//       name,
//       email,
//       password // Will be hashed by pre-save hook
//     });

//     // Generate tokens
//     const accessToken = generateAccessToken(user._id);
//     const refreshToken = generateRefreshToken(user._id);

//     // Save refresh token to database
//     // Use updateOne instead of save to avoid triggering pre-save hook
//     await User.updateOne(
//       { _id: user._id },
//       { $push: { refreshTokens: refreshToken } }
//     );

//     // Send response
//     res.status(201).json({
//       success: true,
//       message: 'User registered successfully',
//       accessToken,
//       refreshToken,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role
//       }
//     });

//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user (include password field)
    const user = await User.findOne({ email }).select('+password +refreshTokens');

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to database
    // Use updateOne instead of save to avoid triggering pre-save hook
    await User.updateOne(
      { _id: user._id },
      { $push: { refreshTokens: refreshToken } }
    );

    // Send response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Find user and check if refresh token exists
    const user = await User.findById(decoded.id).select('+refreshTokens');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if refresh token is in user's token list
    if (!user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed',
      accessToken: newAccessToken
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Remove refresh token from database
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { refreshTokens: refreshToken } }
    );

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};