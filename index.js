
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/debug', async (req, res) => {
  try {
    // Check if tables exist
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Count records in businesses table
    const countResult = await db.query('SELECT COUNT(*) FROM businesses');
    
    res.json({
      tables: tablesResult.rows,
      businessCount: countResult.rows[0].count,
      databaseUrl: process.env.DATABASE_URL ? "Configured" : "Missing"
    });
  } catch (err) {
    console.error('Database debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/businesses', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, business_name, business_type, phone, email, city, state, rating, reviews FROM businesses ORDER BY business_name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM businesses WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching business:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/pipeline/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const result = await db.query(
      'SELECT * FROM website_pipeline WHERE business_id = $1 ORDER BY stage_date DESC',
      [businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pipeline:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
