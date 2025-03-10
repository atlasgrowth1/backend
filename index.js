const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
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
      b.scraped_data->'phone_type' as phone_type,
      b.website_key
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

// Record website view with detailed session tracking
app.post('/api/website-view/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { sessionId, startTime, currentPage } = req.body || {};
    
    // Get visitor information
    const visitorId = req.headers['x-session-id'] || sessionId || 'unknown';
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || '';
    
    // Always record each view with timestamp and session data
    await db.query(
      `INSERT INTO website_pipeline (business_id, template_id, stage, notes)
       VALUES ($1, $2, $3, $4)`,
      [businessId, 'basic_template', 'website viewed', 
       JSON.stringify({
         sessionId: visitorId,
         timestamp: new Date().toISOString(),
         ipAddress,
         userAgent,
         referrer,
         startTime: startTime || Date.now(),
         page: currentPage || 'home'
       })
      ]
    );
    
    // Record detailed analytics event for this view
    await db.query(
      `INSERT INTO analytics_events 
        (business_id, page_path, event_type, visitor_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [businessId, req.headers['referer'] || 'direct', 'websiteView', visitorId, ipAddress, userAgent, referrer]
    );
    
    res.json({ success: true, sessionId: visitorId });
  } catch (err) {
    console.error('Error recording website view:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analytics Event Tracking
app.post('/api/analytics-event', async (req, res) => {
  try {
    const { businessId, eventType, pagePath, duration, scrollDepth, contactMethod, formType, sessionId, currentPage } = req.body;
    
    // Get visitor info
    const visitorId = req.headers['x-session-id'] || sessionId || req.headers['x-visitor-id'] || 'unknown';
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || '';
    
    // Insert analytics event
    await db.query(
      `INSERT INTO analytics_events 
        (business_id, page_path, event_type, duration, visitor_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [businessId, pagePath, eventType, duration || 0, visitorId, ipAddress, userAgent, referrer]
    );

    // If this is a contactClick event and we've never seen this business in "contact_made" stage,
    // update the pipeline to contact_made
    if (eventType === 'contactClick' || eventType === 'formSubmission') {
      const pipelineCheck = await db.query(
        `SELECT id FROM website_pipeline 
         WHERE business_id = $1 AND stage = 'contact_made'
         LIMIT 1`,
        [businessId]
      );
      
      if (pipelineCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO website_pipeline (business_id, template_id, stage, notes)
           VALUES ($1, $2, $3, $4)`,
          [
            businessId, 
            'basic_template', 
            'contact_made', 
            `Contact made via ${contactMethod || formType || eventType} on ${currentPage || 'home'} page`
          ]
        );
      }
    }
    
    // For pageView events, update the analytics_summary
    if (eventType === 'pageView') {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Check if we have a summary for today
      const summaryCheck = await db.query(
        `SELECT id FROM analytics_summary 
         WHERE business_id = $1 AND date = $2
         LIMIT 1`,
        [businessId, today]
      );
      
      if (summaryCheck.rows.length > 0) {
        // Update existing summary
        await db.query(
          `UPDATE analytics_summary 
           SET total_views = total_views + 1,
               unique_visitors = unique_visitors + 
                (SELECT CASE WHEN NOT EXISTS (
                  SELECT 1 FROM analytics_events 
                  WHERE business_id = $1 
                  AND visitor_id = $2
                  AND timestamp::date = $3
                  AND id != currval('analytics_events_id_seq')
                ) THEN 1 ELSE 0 END)
           WHERE business_id = $1 AND date = $3`,
          [businessId, visitorId, today]
        );
      } else {
        // Create new summary
        await db.query(
          `INSERT INTO analytics_summary (business_id, date, total_views, unique_visitors)
           VALUES ($1, $2, 1, 1)`,
          [businessId, today]
        );
      }
    }
    
    // For pageLeave events, update the average time on site
    if (eventType === 'pageLeave' && duration) {
      const today = new Date().toISOString().split('T')[0];
      
      await db.query(
        `UPDATE analytics_summary 
         SET avg_time_on_site = (
           (avg_time_on_site * (total_views - 1) + $3) / total_views
         )
         WHERE business_id = $1 AND date = $2`,
        [businessId, today, duration]
      );
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error recording analytics event:', err);
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

// HVAC-specific routes
app.get(['/hvacs/:businessKey', '/hvacs/:businessKey/:page'], async (req, res) => {
  try {
    let { businessKey, page } = req.params;
    
    // Default page is home
    page = page ? page.toLowerCase() : 'home';
    
    // Valid pages
    const validPages = ['home', 'residential', 'commercial', 'industrial', 'contact'];
    
    if (!validPages.includes(page)) {
      return res.status(404).send(`Invalid page: ${page}. Valid pages are: ${validPages.join(', ')}`);
    }

    console.log(`Looking for HVAC business with key=${businessKey}, page=${page}`);
    
    // Direct query for HVAC business type - exactly match 'hvac'
    const queryResult = await db.query(
      "SELECT * FROM businesses WHERE LOWER(website_key) = LOWER($1) AND business_type = 'hvac'",
      [businessKey]
    );
    console.log(`Query results: ${queryResult.rows.length} rows found`);
    
    if (queryResult.rows.length === 0) {
      // Try to find the business with any type for debugging
      console.log(`No business found with key=${businessKey} and any HVAC-related type, checking for any business with this key`);
      const altResult = await db.query(
        'SELECT id, business_name, business_type, website_key FROM businesses WHERE LOWER(website_key) = LOWER($1)',
        [businessKey]
      );
      
      // Add additional debugging for alternate result
      if (altResult.rows.length > 0) {
        console.log(`Business found with details:`, {
          id: altResult.rows[0].id,
          name: altResult.rows[0].business_name,
          actualType: altResult.rows[0].business_type,
          key: altResult.rows[0].website_key
        });
        
        // If it's an HVAC business, proceed anyway
        if (altResult.rows[0].business_type.toLowerCase() === 'hvac') {
          console.log(`Found HVAC business with key=${businessKey}, proceeding with type: ${altResult.rows[0].business_type}`);
          const business = await db.query('SELECT * FROM businesses WHERE id = $1', [altResult.rows[0].id]);
          if (business.rows.length > 0) {
            return handleHvacBusiness(business.rows[0], page, req, res);
          }
        }
      }
      
      if (altResult.rows.length > 0) {
        console.log(`Found business with key=${businessKey} but not an HVAC type:`, altResult.rows[0]);
        return res.status(404).send(`Business found with key: ${businessKey} but has type: "${altResult.rows[0].business_type}" instead of expected: "hvac"`);
      } else {
        console.log(`No business found with key=${businessKey}`);
        return res.status(404).send(`Business not found with key: ${businessKey}`);
      }
    }
    
    const business = queryResult.rows[0];
    // Use the helper function to handle the HVAC business
    return handleHvacBusiness(business, page, req, res);
  } catch (error) {
    console.error('Error serving HVAC website:', error);
    res.status(500).send('Server error');
  }
});

// Route for legacy 'hvac' URLs - redirect to /hvacs/
app.get(['/hvac/:businessKey', '/hvac/:businessKey/:page'], (req, res) => {
  const { businessKey, page } = req.params;
  const redirectPath = page ? `/hvacs/${businessKey}/${page}` : `/hvacs/${businessKey}`;
  res.redirect(301, redirectPath);
});

// Business website routes for other types (electricians, plumbers)
app.get(['/:businessType/:businessKey', '/:businessType/:businessKey/:page'], async (req, res) => {
  try {
    let { businessType, businessKey, page } = req.params;
    
    // Convert to lowercase for case-insensitive matching
    businessType = businessType.toLowerCase();
    
    // Default page is home
    page = page ? page.toLowerCase() : 'home';
    
    // Valid business types and pages
    const validTypes = ['electricians', 'plumbers'];
    const validPages = ['home', 'residential', 'commercial', 'industrial', 'contact'];
    
    if (!validTypes.includes(businessType)) {
      return res.status(404).send(`Invalid business type: ${businessType}. Valid types are: electricians, plumbers, hvac`);
    }
    
    if (!validPages.includes(page)) {
      return res.status(404).send(`Invalid page: ${page}. Valid pages are: ${validPages.join(', ')}`);
    }

    // Get business data - remove 's' from type for other business types
    const businessTypeForQuery = businessType.slice(0, -1);
    
    console.log(`Looking for business with key=${businessKey}, type=${businessTypeForQuery}, page=${page}`);
    
    const queryResult = await db.query(
      'SELECT * FROM businesses WHERE LOWER(website_key) = LOWER($1) AND business_type = $2',
      [businessKey, businessTypeForQuery]
    );
    console.log(`Query results: ${queryResult.rows.length} rows found`);
    
    if (queryResult.rows.length === 0) {
      // Try without type restriction for debugging
      const altResult = await db.query(
        'SELECT id, business_name, business_type, website_key FROM businesses WHERE LOWER(website_key) = LOWER($1)',
        [businessKey]
      );
      
      if (altResult.rows.length > 0) {
        console.log(`Found business with key=${businessKey} but wrong type:`, altResult.rows[0]);
        return res.status(404).send(`Business found with key: ${businessKey} but has type: "${altResult.rows[0].business_type}" instead of expected: "${businessTypeForQuery}"`);
      } else {
        console.log(`No business found with key=${businessKey}`);
        return res.status(404).send(`Business not found with key: ${businessKey}`);
      }
    }
    
    const business = queryResult.rows[0];
    
    // Determine template paths
    const layoutPath = path.join(__dirname, 'templates', businessTypeForQuery, 'shared', 'layout.html');
    const contentPath = path.join(__dirname, 'templates', businessTypeForQuery, 'pages', `${page}.html`);
    
    // Read the template files
    let layoutTemplate, contentTemplate;
    try {
      layoutTemplate = await fs.readFile(layoutPath, 'utf8');
      contentTemplate = await fs.readFile(contentPath, 'utf8');
    } catch (err) {
      console.error('Template not found:', err);
      return res.status(404).send(`Template not found: ${err.path}`);
    }

    // Insert content into layout
    let template = layoutTemplate.replace('{{content}}', contentTemplate);
    
    // Set page-specific variables
    const pageData = {
      currentPage: page,
      pageTitle: capitalizeFirstLetter(page),
      isHome: page === 'home',
      isResidential: page === 'residential',
      isCommercial: page === 'commercial',
      isIndustrial: page === 'industrial',
      isContact: page === 'contact',
      businessKey: business.website_key
    };
    
    // Define all possible replacement fields
    const replacements = {
      '{{businessName}}': business.business_name || '',
      '{{phone}}': business.phone || '',
      '{{email}}': business.email || '',
      '{{city}}': business.city || '',
      '{{state}}': business.state || '',
      '{{postal_code}}': business.postal_code || '',
      '{{full_address}}': business.full_address || '',
      '{{rating}}': business.rating || '0',
      '{{reviews}}': business.reviews || '0',
      '{{businessData}}': JSON.stringify(business),
      '{{currentPage}}': pageData.currentPage,
      '{{pageTitle}}': pageData.pageTitle,
      '{{businessKey}}': pageData.businessKey
    };

    // Handle conditional classes for navigation
    template = template.replace(/\{\{#if (is\w+)\}\}(.*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return pageData[condition] ? content : '';
    });

    // Replace placeholders with actual data
    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(placeholder, 'g'), value);
    }

    // Send the populated template
    res.send(template);
  } catch (error) {
    console.error('Error serving website:', error);
    res.status(500).send('Server error');
  }
});

// Helper function to capitalize first letter
function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Get analytics data for a business
app.get('/api/analytics/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate dates
    const dateConstraint = startDate && endDate 
      ? 'AND date BETWEEN $2 AND $3' 
      : '';
    
    // Query params
    const params = [businessId];
    if (startDate && endDate) {
      params.push(startDate, endDate);
    }
    
    // Get daily analytics
    const analyticsResult = await db.query(
      `SELECT * FROM analytics_summary 
       WHERE business_id = $1 ${dateConstraint}
       ORDER BY date DESC`,
      params
    );
    
    // Get event counts by type
    const eventsResult = await db.query(
      `SELECT event_type, COUNT(*) as count 
       FROM analytics_events 
       WHERE business_id = $1
       GROUP BY event_type
       ORDER BY count DESC`,
      [businessId]
    );
    
    // Get pipeline history
    const pipelineResult = await db.query(
      `SELECT stage, stage_date, notes 
       FROM website_pipeline 
       WHERE business_id = $1 
       ORDER BY stage_date DESC`,
      [businessId]
    );
    
    // Get view session data from pipeline where stage is 'website viewed'
    const viewSessionsResult = await db.query(
      `SELECT stage_date, notes
       FROM website_pipeline 
       WHERE business_id = $1 AND stage = 'website viewed'
       ORDER BY stage_date DESC`,
      [businessId]
    );
    
    // Process view session data to extract duration and other details
    const viewSessions = viewSessionsResult.rows.map(row => {
      try {
        const sessionData = JSON.parse(row.notes);
        return {
          date: row.stage_date,
          sessionId: sessionData.sessionId,
          timestamp: sessionData.timestamp,
          referrer: sessionData.referrer,
          userAgent: sessionData.userAgent,
          startTime: sessionData.startTime,
          page: sessionData.page || 'home',
          notes: row.notes
        };
      } catch (e) {
        return {
          date: row.stage_date,
          notes: row.notes
        };
      }
    });
    
    // Get page view statistics
    const pageViewsResult = await db.query(
      `SELECT 
         COALESCE(jsonb_extract_path_text(notes::jsonb, 'page'), 'home') as page,
         COUNT(*) as count
       FROM website_pipeline
       WHERE business_id = $1 AND stage = 'website viewed'
       GROUP BY COALESCE(jsonb_extract_path_text(notes::jsonb, 'page'), 'home')
       ORDER BY count DESC`,
      [businessId]
    );
    
    res.json({
      daily: analyticsResult.rows,
      events: eventsResult.rows,
      pipeline: pipelineResult.rows,
      viewSessions: viewSessions,
      pageViews: pageViewsResult.rows
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Helper function to handle HVAC business templates
async function handleHvacBusiness(business, page, req, res) {
  try {
    // Determine template paths for HVAC
    const layoutPath = path.join(__dirname, 'templates', 'hvac', 'shared', 'layout.html');
    const contentPath = path.join(__dirname, 'templates', 'hvac', 'pages', `${page}.html`);
    
    // Read the template files
    let layoutTemplate, contentTemplate;
    try {
      layoutTemplate = await fs.readFile(layoutPath, 'utf8');
      contentTemplate = await fs.readFile(contentPath, 'utf8');
    } catch (err) {
      console.error('Template not found:', err);
      return res.status(404).send(`Template not found: ${err.path}`);
    }

    // Insert content into layout
    let template = layoutTemplate.replace('{{content}}', contentTemplate);
    
    // Set page-specific variables
    const pageData = {
      currentPage: page,
      pageTitle: capitalizeFirstLetter(page),
      isHome: page === 'home',
      isResidential: page === 'residential',
      isCommercial: page === 'commercial',
      isIndustrial: page === 'industrial',
      isContact: page === 'contact',
      businessKey: business.website_key
    };
    
    // Define all possible replacement fields
    const replacements = {
      '{{businessName}}': business.business_name || '',
      '{{phone}}': business.phone || '',
      '{{email}}': business.email || '',
      '{{city}}': business.city || '',
      '{{state}}': business.state || '',
      '{{postal_code}}': business.postal_code || '',
      '{{full_address}}': business.full_address || '',
      '{{rating}}': business.rating || '0',
      '{{reviews}}': business.reviews || '0',
      '{{businessData}}': JSON.stringify(business),
      '{{currentPage}}': pageData.currentPage,
      '{{pageTitle}}': pageData.pageTitle,
      '{{businessKey}}': pageData.businessKey
    };

    // Handle conditional classes for navigation
    template = template.replace(/\{\{#if (is\w+)\}\}(.*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return pageData[condition] ? content : '';
    });

    // Replace placeholders with actual data
    for (const [placeholder, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(placeholder, 'g'), value);
    }

    // Send the populated template
    return res.send(template);
  } catch (error) {
    console.error('Error serving HVAC website:', error);
    return res.status(500).send('Server error');
  }
}
