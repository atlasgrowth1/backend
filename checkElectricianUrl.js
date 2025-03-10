
const db = require('./db');

async function checkElectrician() {
  try {
    console.log("Checking electrician business with key 'advancedelectricalcompany'");
    
    // Query the database for the business
    const result = await db.query(
      "SELECT id, business_name, business_type, website_key FROM businesses WHERE LOWER(website_key) = LOWER($1)",
      ['advancedelectricalcompany']
    );
    
    if (result.rows.length > 0) {
      const business = result.rows[0];
      console.log("Business found:");
      console.log(`ID: ${business.id}`);
      console.log(`Name: ${business.business_name}`);
      console.log(`Type: ${business.business_type}`);
      console.log(`Key: ${business.website_key}`);
      
      console.log("\nBusiness should be accessible at:");
      console.log(`/electricians/${business.website_key}`);
      
      if (business.business_type !== 'electrician') {
        console.log("\nNOTE: The business type in the database doesn't match 'electrician'.");
        console.log("It's currently set to:", business.business_type);
        console.log("This might cause issues since we're expecting lowercase 'electrician'.");
      }
    } else {
      console.log("No business found with key 'advancedelectricalcompany'");
    }
    
    // Check if electrician template exists
    const fs = require('fs');
    const path = require('path');
    
    const templatePath = path.join(__dirname, 'templates', 'electrician.html');
    console.log(`\nChecking if electrician template exists at: ${templatePath}`);
    console.log(`Template exists: ${fs.existsSync(templatePath)}`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkElectrician();
