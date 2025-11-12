const crypto = require('crypto');
const Device = require('../models/Device');

// HMAC signature verification
const verifySignature = async (req, res, next) => {
  try {
    const { device_id, signature, ...payload } = req.body;
    const timestamp = req.headers['x-timestamp'];
    
    console.log('🔐 Signature verification attempt:', {
      device_id,
      signatureLength: signature?.length,
      timestamp,
      payloadKeys: Object.keys(payload)
    });

    // Validate required fields
    if (!device_id || !signature || !timestamp) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required headers: device_id, signature, x-timestamp' 
      });
    }

    // Check timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes tolerance
      console.log('❌ Timestamp expired');
      return res.status(400).json({ error: 'Request timestamp expired' });
    }

    // Get device and secret key
    const device = await Device.findOne({ device_id });
    if (!device) {
      console.log('❌ Device not found:', device_id);
      return res.status(403).json({ error: 'Unauthorized device' });
    }

    if (device.status !== 'active') {
      console.log('❌ Device not active');
      return res.status(403).json({ error: 'Device is not active' });
    }

    // Verify HMAC signature - FIXED VERSION
    const hmac = crypto.createHmac('sha256', device.secret_key);
    
    // Create the exact same data structure that was signed
    const dataToSign = {
      ...payload,
      timestamp: requestTime
    };
    
    // Stringify with same formatting
    const dataString = JSON.stringify(dataToSign);
    const expectedSignature = hmac.update(dataString).digest('hex');

    console.log('🔐 Signature details:', {
      receivedSignature: signature,
      expectedSignature: expectedSignature,
      dataString: dataString,
      secretKeyLength: device.secret_key.length
    });

    // FIX: Handle different signature lengths gracefully
    if (signature.length !== expectedSignature.length) {
      console.log('❌ Signature length mismatch');
      return res.status(403).json({ error: 'Invalid signature length' });
    }

    // Use simple comparison for development (remove in production)
    if (signature !== expectedSignature) {
      console.log('❌ Signature mismatch');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // In production, use timingSafeEqual:
    // if (!crypto.timingSafeEqual(
    //   Buffer.from(signature, 'hex'),
    //   Buffer.from(expectedSignature, 'hex')
    // )) {
    //   return res.status(403).json({ error: 'Invalid signature' });
    // }

    console.log('✅ Signature verified successfully');
    
    // Attach device to request for later use
    req.device = device;
    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    
    // More specific error handling
    if (error.code === 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH') {
      return res.status(400).json({ error: 'Signature length mismatch' });
    }
    
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Development mode - bypass signature verification
const developmentModeAuth = async (req, res, next) => {
  // Skip authentication in development for testing
  if (process.env.NODE_ENV === 'development') {
    console.log('🔓 Development mode - bypassing authentication');
    
    const { device_id } = req.body;
    
    // Still validate device exists
    if (device_id) {
      const device = await Device.findOne({ device_id });
      if (device) {
        req.device = device;
      } else {
        // Create a temporary device for development
        req.device = {
          device_id: device_id,
          secret_key: 'development-secret-key',
          status: 'active'
        };
      }
    }
    
    return next();
  }
  
  // Use real authentication in production
  verifySignature(req, res, next);
};

// Rate limiting per device
const deviceRateLimit = new Map();

const rateLimitByDevice = (req, res, next) => {
  const deviceId = req.body.device_id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // 30 requests per minute per device

  if (!deviceId) return next();

  if (!deviceRateLimit.has(deviceId)) {
    deviceRateLimit.set(deviceId, []);
  }

  const requests = deviceRateLimit.get(deviceId);
  const windowStart = now - windowMs;
  
  // Clean old requests
  const recentRequests = requests.filter(time => time > windowStart);
  deviceRateLimit.set(deviceId, recentRequests);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    });
  }

  recentRequests.push(now);
  next();
};

module.exports = {
  verifySignature,
  developmentModeAuth, // Use this for development
  rateLimitByDevice
};