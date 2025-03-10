const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs').promises;
const db = require('./db');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API routes
app.use('/api/businesses', require('./routes/businesses'));
app.use('/api/analytics', require('./routes/analytics'));

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
    let template = await fs.readFile(
      path.join(__dirname, 'templates', `${businessType.slice(0, -1)}.html`), 
      'utf8'
    );

    // Replace placeholders with actual data
    template = template
      .replace('{{businessName}}', business.business_name)
      .replace('{{businessData}}', JSON.stringify(business));

    // Update pipeline if this is first view
    try {
      const { rows: pipelineRows } = await db.query(
        `SELECT COUNT(*) FROM website_pipeline 
         WHERE business_id = $1 AND stage = 'website viewed'`,
        [business.id]
      );

      if (parseInt(pipelineRows[0].count) === 0) {
        await db.query(
          `INSERT INTO website_pipeline (business_id, stage, notes) 
           VALUES ($1, $2, $3)`,
          [business.id, 'website viewed', `First viewed on ${new Date().toISOString()}`]
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

// Admin dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to the Business Website Generator');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});