const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Basic admin authentication middleware (you can enhance this)
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  // Simple token check - replace with proper admin auth
  const token = authHeader.split(' ')[1];
  if (token !== 'your-admin-token') { // Change this in production!
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  next();
};

// Get system overview
router.get('/overview', adminAuth, async (req, res) => {
  try {
    const [
      totalDevices,
      activeDevices,
      totalPayments,
      totalUsers,
      recentPayments,
      deviceStatus
    ] = await Promise.all([
      Device.countDocuments(),
      Device.countDocuments({ status: 'active' }),
      Payment.countDocuments(),
      User.countDocuments(),
      Payment.find().sort({ timestamp: -1 }).limit(10),
      Device.find().sort({ last_heartbeat: -1 })
    ]);

    const totalAmount = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      overview: {
        total_devices: totalDevices,
        active_devices: activeDevices,
        total_payments: totalPayments,
        total_users: totalUsers,
        total_amount: totalAmount[0]?.total || 0
      },
      recent_activity: {
        payments: recentPayments,
        devices: deviceStatus
      }
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all devices
router.get('/devices', adminAuth, async (req, res) => {
  try {
    const devices = await Device.find().sort({ created_at: -1 });
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;