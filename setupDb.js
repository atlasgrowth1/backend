
const db = require('./db');

async function setupDatabase() {
  try {
    // Create businesses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        business_type VARCHAR(50) NOT NULL,
        website_key VARCHAR(100) NOT NULL UNIQUE,
        phone VARCHAR(50),
        email VARCHAR(100),
        street VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        postal_code VARCHAR(20),
        full_address TEXT,
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        rating NUMERIC(2,1),
        reviews INTEGER,
        description TEXT,
        working_hours JSONB,
        social_links JSONB,
        scraped_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create website_pipeline table
    await db.query(`
      CREATE TABLE IF NOT EXISTS website_pipeline (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id),
        template_id VARCHAR(100) NOT NULL,
        stage VARCHAR(50) NOT NULL,
        stage_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      );
    `);

    // Create analytics_events table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id),
        page_path VARCHAR(255),
        event_type VARCHAR(50),
        duration INTEGER,
        visitor_id VARCHAR(100),
        ip_address VARCHAR(50),
        user_agent TEXT,
        referrer VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create analytics_summary table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_summary (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id),
        date DATE,
        total_views INTEGER DEFAULT 0,
        unique_visitors INTEGER DEFAULT 0,
        avg_time_on_site INTEGER DEFAULT 0,
        bounce_rate NUMERIC(5,2) DEFAULT 0
      );
    `);

    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    // Close the pool
    db.pool.end();
  }
}

setupDatabase();
