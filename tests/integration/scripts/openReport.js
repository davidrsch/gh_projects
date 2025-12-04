const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const reportPath = path.resolve(__dirname, '../../../out/test-artifacts/test-report.html');

console.log('Opening test report...');

// Check if report exists
if (!fs.existsSync(reportPath)) {
    console.error('❌ Report not found at:', reportPath);
    console.log('Run tests first to generate the report.');
    process.exit(1);
}

// Open the report in the default browser
const command = process.platform === 'win32'
    ? `start "" "${reportPath}"`
    : process.platform === 'darwin'
        ? `open "${reportPath}"`
        : `xdg-open "${reportPath}"`;

exec(command, (error) => {
    if (error) {
        console.error('❌ Failed to open report:', error);
        console.log('Please open manually:', reportPath);
        process.exit(1);
    }
    console.log('✅ Report opened in browser');
});
