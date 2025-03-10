
const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');
const path = require('path');

async function importHvacData() {
  const results = [];
  const filePath = path.join(__dirname, 'attached_assets', 'Untitled spreadsheet - Generated by Outscraper ©.csv');

  // Function to read and parse a CSV file
  const readCsvFile = (filePath) => {
    return new Promise((resolve, reject) => {
      const fileResults = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => fileResults.push(data))
        .on('end', () => resolve(fileResults))
        .on('error', (error) => reject(error));
    });
  };

  try {
    const fileResults = await readCsvFile(filePath);
    console.log(`Processed ${fileResults.length} HVAC records`);
    results.push(...fileResults);
    
    console.log(`Total HVAC records to process: ${results.length}`);
    
    for (const record of results) {
      // Create a lowercase website key for URLs based on business name
      const websiteKey = record.name ? record.name.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 100) : `hvac${Math.random().toString(36).substring(2, 7)}`;
      
      // Parse working hours into JSON
      let workingHours = {};
      try {
        if (record.working_hours) {
          workingHours = JSON.parse(record.working_hours.replace(/'/g, '"'));
        }
      } catch (e) {
        console.error('Error parsing working hours:', e);
      }

      // Insert into businesses table
      const query = `
        INSERT INTO businesses (
          business_name, business_type, website_key, phone, email, 
          street, city, state, postal_code, full_address, 
          latitude, longitude, rating, reviews, description, 
          working_hours, social_links, scraped_data
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (website_key) DO UPDATE SET
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          rating = EXCLUDED.rating,
          reviews = EXCLUDED.reviews,
          working_hours = EXCLUDED.working_hours,
          social_links = EXCLUDED.social_links,
          scraped_data = EXCLUDED.scraped_data
        RETURNING id
      `;

      // Store everything else in scraped_data
      const scrapedData = { ...record };
      
      // Parse numeric values properly
      let reviews = null;
      if (record.reviews) {
        reviews = Math.round(parseFloat(record.reviews));
      }
      
      const values = [
        record.name || null,
        'hvac', // Setting type as 'hvac' for consistency
        websiteKey,
        record.phone || null,
        record.email_1 || record.email || null,
        record.street || null,
        record.city || null,
        record.state || null,
        record.postal_code || null,
        record.full_address || null,
        record.latitude ? parseFloat(record.latitude) : null,
        record.longitude ? parseFloat(record.longitude) : null,
        record.rating ? parseFloat(record.rating) : null,
        reviews,
        record.description || null,
        JSON.stringify(workingHours),
        JSON.stringify({}),
        JSON.stringify(scrapedData)
      ];

      const res = await db.query(query, values);
      const businessId = res.rows[0].id;
      
      console.log(`Inserted/updated HVAC business: ${record.name}, ID: ${businessId}`);
      
      // Create initial pipeline entry
      await db.query(
        `INSERT INTO website_pipeline (business_id, template_id, stage, notes)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING`,
        [businessId, 'basic_template', 'website created', 'Initial pipeline entry']
      );
    }

    console.log('HVAC data import completed successfully');
  } catch (err) {
    console.error('Error importing HVAC data:', err);
  } finally {
    db.pool.end();
  }
}

importHvacData();
