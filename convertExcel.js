
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function convertExcelToCSV() {
  const excelPath = path.join(__dirname, 'attached_assets', 'Outscraper-20250306231552s80_electrician.xlsx');
  const outputPath = path.join(__dirname, 'attached_assets', 'converted_electrician.csv');
  
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(excelPath);
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to CSV
    const csv = xlsx.utils.sheet_to_csv(sheet);
    
    // Write to file
    fs.writeFileSync(outputPath, csv);
    
    console.log(`Excel file converted to CSV: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error('Error converting Excel to CSV:', err);
    throw err;
  }
}

// Export the function if called as module
if (require.main === module) {
  convertExcelToCSV();
}

module.exports = { convertExcelToCSV };
