const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Device = require('../models/Device');
const { verifySignature } = require('../middleware/auth');

// Register new device
router.post('/register', async (req, res) => {
  try {
    const { device_id, name } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Check if device already exists
    const existingDevice = await Device.findOne({ device_id });
    if (existingDevice) {
      return res.status(400).json({ error: 'Device already registered' });
    }

    // Generate secret key for the device
    const secret_key = crypto.randomBytes(32).toString('hex');

    // Create new device
    const device = new Device({
      device_id,
      name: name || 'Detector Phone',
      secret_key
    });

    await device.save();

    // Return device info (only return secret key once!)
    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      device: {
        device_id: device.device_id,
        name: device.name,
        secret_key: device.secret_key, // Only time this is returned!
        created_at: device.created_at
      }
    });

  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat endpoint
router.post('/heartbeat', verifySignature, async (req, res) => {
  try {
    req.device.last_heartbeat = new Date();
    await req.device.save();

    res.json({
      success: true,
      timestamp: new Date(),
      status: 'active'
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get device status
router.get('/status', verifySignature, async (req, res) => {
  try {
    const device = req.device;

    // Calculate uptime (simple version)
    const timeDiff = Date.now() - device.last_heartbeat.getTime();
    const status = timeDiff < 10 * 60 * 1000 ? 'online' : 'offline'; // 10 minutes threshold

    res.json({
      device_id: device.device_id,
      name: device.name,
      status: device.status,
      connectivity: status,
      last_heartbeat: device.last_heartbeat,
      created_at: device.created_at
    });
  } catch (error) {
    console.error('Device status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;