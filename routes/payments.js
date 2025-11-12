const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');

// Get all payments (with filtering and pagination) - NO AUTH
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      bank, 
      device_id, 
      start_date, 
      end_date,
      processed 
    } = req.query;

    // Build filter object
    const filter = {};
    if (bank) filter.bank = bank;
    if (device_id) filter.device_id = device_id;
    if (processed !== undefined) filter.processed = processed === 'true';
    if (start_date || end_date) {
      filter.timestamp = {};
      if (start_date) filter.timestamp.$gte = new Date(start_date);
      if (end_date) filter.timestamp.$lte = new Date(end_date);
    }

    const payments = await Payment.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Payment.countDocuments(filter);
    const totalAmount = await Payment.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      payments,
      summary: {
        total_payments: total,
        total_amount: totalAmount[0]?.total || 0,
        average_amount: total > 0 ? (totalAmount[0]?.total || 0) / total : 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get payment statistics - NO AUTH
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await Payment.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$bank',
          count: { $sum: 1 },
          total_amount: { $sum: '$amount' },
          avg_amount: { $avg: '$amount' }
        }
      },
      {
        $sort: { total_amount: -1 }
      }
    ]);

    const dailyStats = await Payment.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          count: { $sum: 1 },
          total_amount: { $sum: '$amount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      bank_stats: stats,
      daily_stats: dailyStats,
      period: {
        start_date: startDate,
        end_date: new Date(),
        days: parseInt(days)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;