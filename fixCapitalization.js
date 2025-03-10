const db = require('./db');

async function fixCapitalization() {
  try {
    console.log("Starting to fix capitalization in business types...");
    
    // First, check all business types
    const checkResult = await db.query(
      "SELECT business_type, COUNT(*) FROM businesses GROUP BY business_type"
    );
    
    console.log("Current business types in database:");
    checkResult.rows.forEach(row => {
      console.log(`- "${row.business_type}": ${row.count} businesses`);
    });
    
    // Update all business types to lowercase
    const updateResult = await db.query(
      "UPDATE businesses SET business_type = LOWER(business_type) RETURNING business_type, id"
    );
    
    console.log(`Updated ${updateResult.rows.length} records to lowercase business types`);
    
    // Verify the changes
    const verifyResult = await db.query(
      "SELECT business_type, COUNT(*) FROM businesses GROUP BY business_type"
    );
    
    console.log("Business types after update:");
    verifyResult.rows.forEach(row => {
      console.log(`- "${row.business_type}": ${row.count} businesses`);
    });
    
    // Specifically check the problematic business
    const specificCheck = await db.query(
      "SELECT id, business_name, business_type FROM businesses WHERE website_key = 'advancedelectricalcompany'"
    );
    
    if (specificCheck.rows.length > 0) {
      console.log("\nChecking problematic business:");
      console.log(`- ID: ${specificCheck.rows[0].id}`);
      console.log(`- Name: ${specificCheck.rows[0].business_name}`);
      console.log(`- Type: ${specificCheck.rows[0].business_type}`);
    }
    
    console.log("\nCapitalization fix completed");
  } catch (err) {
    console.error('Error fixing capitalization:', err);
  } finally {
    // Close the pool
    await db.pool.end();
  }
}

fixCapitalization();