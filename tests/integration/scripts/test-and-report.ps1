# Run integration tests and open the report
npm run test:integration
if ($LASTEXITCODE -eq 0) {
    npm run test:report
} else {
    Write-Host "Tests failed, but opening report anyway..." -ForegroundColor Yellow
    npm run test:report
}
