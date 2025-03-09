
const fs = require('fs');
const csv = require('csv-parser');
const db = require('./db');
const path = require('path');
const { convertExcelToCSV } = require('./convertExcel');

async function importData() {
  // Convert Excel to CSV first
  let convertedFilePath;
  try {
    convertedFilePath = convertExcelToCSV();
    console.log('Successfully converted Excel to CSV');
  } catch (err) {
    console.error('Error converting Excel file:', err);
  }

  const results = [];
  const filePaths = [
    path.join(__dirname, 'attached_assets', 'Outscraper-20250307092319s54_electrician.csv')
  ];
  
  // Add the converted file if it exists
  if (convertedFilePath) {
    filePaths.push(convertedFilePath);
  }

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

  // Read and parse all CSV files
  try {
    for (const filePath of filePaths) {
      const fileResults = await readCsvFile(filePath);
      console.log(`Processed ${fileResults.length} records from ${filePath}`);
      results.push(...fileResults);
    }
    
    console.log(`Total records to process: ${results.length}`);
    
    try {
      console.log(`Processing ${results.length} records...`);

      for (const record of results) {
        // Create a lowercase website key for URLs based on business name
        const websiteKey = record.name.toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 100);
        
        // Parse working hours into JSON
        let workingHours = {};
        try {
          if (record.working_hours) {
            workingHours = JSON.parse(record.working_hours.replace(/'/g, '"'));
          }
        } catch (e) {
          console.error('Error parsing working hours:', e);
        }

        // Parse social links into JSON
        const socialLinks = {};
        const socialPlatforms = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'];
        
        for (const platform of socialPlatforms) {
          if (record[platform] && record[platform].trim() !== '') {
            socialLinks[platform] = record[platform];
          }
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
        delete scrapedData.name;
        delete scrapedData.business_type;
        delete scrapedData.phone;
        delete scrapedData.email;
        delete scrapedData.street;
        delete scrapedData.city; 
        delete scrapedData.state;
        delete scrapedData.postal_code;
        delete scrapedData.full_address;
        delete scrapedData.latitude;
        delete scrapedData.longitude;
        delete scrapedData.rating;
        delete scrapedData.reviews;
        delete scrapedData.description;
        delete scrapedData.working_hours;

        // Parse numeric values properly
        let reviews = null;
        if (record.reviews) {
          // Convert to integer by parsing and rounding
          reviews = Math.round(parseFloat(record.reviews));
        }
        
        const values = [
          record.name || null,
          record.type || 'electrician',
          websiteKey,
          record.phone || null,
          record.email_1 || null,
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
          JSON.stringify(socialLinks),
          JSON.stringify(scrapedData)
        ];

        const res = await db.query(query, values);
        const businessId = res.rows[0].id;
        
        console.log(`Inserted/updated business: ${record.name}, ID: ${businessId}`);
        
        // Create initial pipeline entry
        await db.query(
          `INSERT INTO website_pipeline (business_id, template_id, stage, notes)
            VALUES ($1, $2, $3, $4)`,
          [businessId, 'basic_template', 'website created', 'Initial pipeline entry']
        );
      }

      console.log('Data import completed successfully');
    } catch (err) {
      console.error('Error importing data:', err);
    } finally {
      db.pool.end();
    }
  } catch (err) {
    console.error('Error reading CSV files:', err);
    db.pool.end();
  }
}

importData();
