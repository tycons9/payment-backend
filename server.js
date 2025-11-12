const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
let payments = [];
let devices = [];

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'In-memory (development)',
    payments_count: payments.length,
    devices_count: devices.length
  });
});

// Receive payment endpoint
app.post('/api/sms/receive', (req, res) => {
  console.log('🎯 RECEIVED PAYMENT:', req.body);
  
  const { device_id, bank, amount, from, message_id } = req.body;
  
  // Simple validation
  if (!device_id || !bank || !amount) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required fields: device_id, bank, amount' 
    });
  }
  
  // Create payment record
  const payment = {
    id: message_id || `pay_${Date.now()}`,
    device_id,
    bank,
    amount: parseFloat(amount),
    from: from || 'Unknown',
    timestamp: new Date().toISOString(),
    received_at: new Date().toISOString(),
    status: 'processed'
  };
  
  payments.unshift(payment);
  
  console.log(`💰 Payment stored: ${amount} ETB from ${bank} (${from})`);
  
  res.json({
    success: true,
    message: 'Payment processed successfully',
    payment_id: payment.id,
    received: payment
  });
});

// Get all payments
app.get('/api/payments', (req, res) => {
  const summary = {
    total_payments: payments.length,
    total_amount: payments.reduce((sum, p) => sum + p.amount, 0),
    average_amount: payments.length > 0 ? 
      payments.reduce((sum, p) => sum + p.amount, 0) / payments.length : 0,
    by_bank: payments.reduce((acc, p) => {
      acc[p.bank] = (acc[p.bank] || 0) + 1;
      return acc;
    }, {})
  };
  
  res.json({
    success: true,
    payments: payments.slice(0, 50), // Return latest 50
    summary
  });
});

// Device registration
app.post('/api/devices/register', (req, res) => {
  const { device_id, name } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ 
      success: false,
      error: 'device_id is required' 
    });
  }
  
  const existingDevice = devices.find(d => d.device_id === device_id);
  
  if (existingDevice) {
    return res.json({
      success: true,
      message: 'Device already registered',
      device: existingDevice
    });
  }
  
  const device = {
    device_id,
    name: name || 'Payment Detector Device',
    registered_at: new Date().toISOString(),
    status: 'active',
    secret_key: `sk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  devices.push(device);
  
  res.json({
    success: true,
    message: 'Device registered successfully',
    device: {
      ...device,
      secret_key: device.secret_key // In production, don't return the secret key
    }
  });
});

// Device heartbeat
app.post('/api/devices/heartbeat', (req, res) => {
  const { device_id } = req.body;
  
  const device = devices.find(d => d.device_id === device_id);
  if (device) {
    device.last_heartbeat = new Date().toISOString();
  }
  
  res.json({
    success: true,
    message: 'Heartbeat received',
    timestamp: new Date().toISOString()
  });
});

// Clear all data (for testing)
app.delete('/api/clear', (req, res) => {
  payments = [];
  devices = [];
  res.json({ success: true, message: 'All data cleared' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 SMS endpoint: http://localhost:${PORT}/api/sms/receive`);
  console.log('💡 Using in-memory storage (data resets on server restart)');
});