
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
    let query = `
      SELECT b.id, b.business_name, b.business_type, b.phone, b.email, b.city, b.state, b.rating, b.reviews, 
      (SELECT stage FROM website_pipeline WHERE business_id = b.id ORDER BY stage_date DESC LIMIT 1) as current_stage,
      b.scraped_data->'phone_type' as phone_type
      FROM businesses b
    `;
    
    // Add filtering logic
    const params = [];
    const conditions = [];
    
    // Filter by state if provided
    if (req.query.state) {
      conditions.push(`LOWER(b.state) = LOWER($${params.length + 1})`);
      params.push(req.query.state);
    }
    
    // Filter by pipeline stage if provided
    if (req.query.stage) {
      conditions.push(`
        (SELECT stage FROM website_pipeline WHERE business_id = b.id ORDER BY stage_date DESC LIMIT 1) = $${params.length + 1}
      `);
      params.push(req.query.stage);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY b.business_name';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update pipeline stage
app.post('/api/pipeline/:businessId', express.json(), async (req, res) => {
  try {
    const { businessId } = req.params;
    const { stage, notes } = req.body;
    
    // Validate inputs
    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }
    
    // Insert new pipeline entry
    const result = await db.query(
      `INSERT INTO website_pipeline (business_id, template_id, stage, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [businessId, 'basic_template', stage, notes || '']
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating pipeline:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Record website view (auto-update to "website viewed" stage)
app.post('/api/website-view/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    // Check if already viewed
    const checkResult = await db.query(
      `SELECT id FROM website_pipeline 
       WHERE business_id = $1 AND stage = 'website viewed'
       LIMIT 1`,
      [businessId]
    );
    
    // Only add the entry if it doesn't exist
    if (checkResult.rows.length === 0) {
      await db.query(
        `INSERT INTO website_pipeline (business_id, template_id, stage, notes)
         VALUES ($1, $2, $3, $4)`,
        [businessId, 'basic_template', 'website viewed', 'Automatically recorded website view']
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error recording website view:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available states for filtering
app.get('/api/states', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT state FROM businesses WHERE state IS NOT NULL ORDER BY state');
    res.json(result.rows.map(row => row.state));
  } catch (err) {
    console.error('Error fetching states:', err);
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

// Business website route
app.get('/:businessType/:businessKey', async (req, res) => {
  try {
    const { businessType, businessKey } = req.params;

    // Valid business types
    const validTypes = ['electricians', 'plumbers', 'hvac'];
    if (!validTypes.includes(businessType)) {
      return res.status(404).send('Invalid business type');
    }

    // Get business data
    const { rows } = await db.query(
      'SELECT * FROM businesses WHERE website_key = $1 AND business_type = $2',
      [businessKey, businessType.slice(0, -1)] // Remove 's' from type
    );

    if (rows.length === 0) {
      return res.status(404).send('Business not found');
    }

    const business = rows[0];

    // Read the template file
    const fs = require('fs').promises;
    const path = require('path');
    let template;
    
    try {
      template = await fs.readFile(
        path.join(__dirname, 'templates', `${businessType.slice(0, -1)}.html`), 
        'utf8'
      );
    } catch (err) {
      console.error('Template not found:', err);
      return res.status(404).send('Template not found');
    }

    // Replace placeholders with actual data
    template = template
      .replace('{{businessName}}', business.business_name)
      .replace('{{businessData}}', JSON.stringify(business));

    // Update pipeline if this is first view
    try {
      const pipelineRows = await db.query(
        `SELECT COUNT(*) FROM website_pipeline 
         WHERE business_id = $1 AND stage = 'website viewed'`,
        [business.id]
      );

      if (parseInt(pipelineRows.rows[0].count) === 0) {
        await db.query(
          `INSERT INTO website_pipeline (business_id, template_id, stage, notes) 
           VALUES ($1, $2, $3, $4)`,
          [business.id, 'basic_template', 'website viewed', `First viewed on ${new Date().toISOString()}`]
        );
      }
    } catch (err) {
      console.error('Error updating pipeline:', err);
    }

    // Send the populated template
    res.send(template);
  } catch (error) {
    console.error('Error serving website:', error);
    res.status(500).send('Server error');
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
