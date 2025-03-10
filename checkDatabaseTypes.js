
const db = require('./db');

async function checkDatabaseTypes() {
  try {
    console.log("===== DATABASE DIAGNOSTIC TOOL =====");
    console.log("Checking database connection...");
    
    // Test connection
    const connectResult = await db.query('SELECT NOW() as time');
    console.log(`Database connected: ${connectResult.rows[0].time}`);
    
    // Check business types
    const typesResult = await db.query(
      "SELECT business_type, COUNT(*) FROM businesses GROUP BY business_type ORDER BY COUNT(*) DESC"
    );
    
    console.log("\n===== BUSINESS TYPES IN DATABASE =====");
    typesResult.rows.forEach(row => {
      console.log(`- "${row.business_type}": ${row.count} businesses`);
    });
    
    // Check specific business
    console.log("\n===== CHECKING PROBLEM BUSINESS =====");
    const specificResult = await db.query(
      "SELECT id, business_name, business_type, website_key FROM businesses WHERE website_key = 'advancedelectricalcompany'"
    );
    
    if (specificResult.rows.length > 0) {
      const business = specificResult.rows[0];
      console.log(`Business found: ${business.business_name}`);
      console.log(`ID: ${business.id}`);
      console.log(`Type: "${business.business_type}"`);
      console.log(`Website Key: ${business.website_key}`);
      
      // Try to access the URL
      console.log(`\nTry accessing: /electricians/${business.website_key}`);
      console.log(`or: /electrician/${business.website_key}`);
    } else {
      console.log("Business with key 'advancedelectricalcompany' not found");
      
      // Check for similar businesses
      const similarResult = await db.query(
        "SELECT id, business_name, business_type, website_key FROM businesses WHERE business_type LIKE '%electric%' LIMIT 5"
      );
      
      if (similarResult.rows.length > 0) {
        console.log("\n===== SAMPLE ELECTRICIAN BUSINESSES =====");
        similarResult.rows.forEach(business => {
          console.log(`- ${business.business_name} (${business.business_type}): /electricians/${business.website_key}`);
        });
      }
    }
    
    console.log("\n===== DATABASE TABLES =====");
    const tablesResult = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (err) {
    console.error('Error running diagnostics:', err);
  } finally {
    console.log("\n===== DIAGNOSTICS COMPLETE =====");
    await db.pool.end();
  }
}

checkDatabaseTypes();
