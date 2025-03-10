
const db = require('./db');

async function checkHvacBusinesses() {
  try {
    // Query to check all HVAC businesses
    const result = await db.query(`
      SELECT id, business_name, business_type, website_key 
      FROM businesses 
      WHERE business_type ILIKE '%hvac%'
    `);
    
    console.log(`Found ${result.rows.length} HVAC businesses in database:`);
    result.rows.forEach(business => {
      console.log(`ID: ${business.id}, Name: ${business.business_name}, Type: ${business.business_type}, Key: ${business.website_key}`);
    });
    
    // Check template directories
    console.log("\nChecking if HVAC template directory exists...");
    const fs = require('fs');
    const path = require('path');
    
    const hvacTemplateDir = path.join(__dirname, 'templates', 'hvac');
    if (fs.existsSync(hvacTemplateDir)) {
      console.log("HVAC template directory exists.");
      
      // Check for required template files
      const requiredFiles = [
        path.join(hvacTemplateDir, 'shared', 'layout.html'),
        path.join(hvacTemplateDir, 'pages', 'home.html'),
        path.join(hvacTemplateDir, 'pages', 'contact.html')
      ];
      
      requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
          console.log(`Template file exists: ${file}`);
        } else {
          console.log(`Template file MISSING: ${file}`);
        }
      });
    } else {
      console.log("HVAC template directory is MISSING!");
    }
  } catch (err) {
    console.error('Error checking HVAC businesses:', err);
  } finally {
    db.pool.end();
  }
}

checkHvacBusinesses();
