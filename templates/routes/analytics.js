const express = require('express');
const router = express.Router();
const db = require('../db');

// Track analytics events
router.post('/track', async (req, res) => {
  try {
    const { businessId, eventType, pagePath, visitorId, duration = 0 } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // 1. Insert analytics event
    await db.query(
      `INSERT INTO analytics_events 
      (business_id, event_type, page_path, visitor_id, duration, ip_address, user_agent) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [businessId, eventType, pagePath, visitorId, duration, ipAddress, userAgent]
    );

    // 2. If this is the first view, update pipeline stage
    if (eventType === 'pageview') {
      const { rows } = await db.query(
        `SELECT COUNT(*) as count FROM website_pipeline 
         WHERE business_id = $1 AND stage = 'website viewed'`,
        [businessId]
      );

      if (parseInt(rows[0].count) === 0) {
        await db.query(
          `INSERT INTO website_pipeline (business_id, stage, notes) 
           VALUES ($1, $2, $3)`,
          [businessId, 'website viewed', `First viewed on ${new Date().toISOString()}`]
        );
      }
    }

    // 3. Send success response
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    res.status(500).json({ error: 'Analytics tracking failed' });
  }
});

// Get analytics for a business
router.get('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { days = 30 } = req.query;

    // Get page views
    const { rows: pageViews } = await db.query(
      `SELECT page_path, COUNT(*) as views 
       FROM analytics_events 
       WHERE business_id = $1 AND event_type = 'pageview'
       AND timestamp >= NOW() - INTERVAL '${days} days'
       GROUP BY page_path ORDER BY views DESC`,
      [businessId]
    );

    // Get average time on site
    const { rows: timeData } = await db.query(
      `SELECT AVG(duration) as avg_time
       FROM analytics_events 
       WHERE business_id = $1 AND event_type = 'exit'
       AND duration > 0
       AND timestamp >= NOW() - INTERVAL '${days} days'`,
      [businessId]
    );

    // Get unique visitors
    const { rows: visitorData } = await db.query(
      `SELECT COUNT(DISTINCT visitor_id) as unique_visitors
       FROM analytics_events 
       WHERE business_id = $1
       AND timestamp >= NOW() - INTERVAL '${days} days'`,
      [businessId]
    );

    res.json({
      pageViews,
      averageTimeOnSite: timeData[0].avg_time || 0,
      uniqueVisitors: visitorData[0].unique_visitors || 0
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;