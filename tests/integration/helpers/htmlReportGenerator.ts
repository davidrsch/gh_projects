import * as fs from 'fs';
import * as path from 'path';

export interface TestStep {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    screenshot?: string;
    error?: string;
    details?: any;
}

export interface TestSuite {
    name: string;
    startTime: Date;
    endTime?: Date;
    steps: TestStep[];
}

export class HTMLReportGenerator {
    private suite: TestSuite;
    private stepStartTime: number = 0;

    constructor(suiteName: string) {
        this.suite = {
            name: suiteName,
            startTime: new Date(),
            steps: []
        };
    }

    startStep(name: string) {
        this.stepStartTime = Date.now();
        console.log(`▶️  ${name}`);
    }

    endStep(name: string, status: 'pass' | 'fail' | 'skip', details?: any, screenshot?: string, error?: string) {
        const duration = Date.now() - this.stepStartTime;
        this.suite.steps.push({
            name,
            status,
            duration,
            screenshot,
            error,
            details
        });

        const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
        console.log(`${icon} ${name} (${duration}ms)`);
    }

    async generate(outputPath: string) {
        this.suite.endTime = new Date();
        const duration = this.suite.endTime.getTime() - this.suite.startTime.getTime();

        const passCount = this.suite.steps.filter(s => s.status === 'pass').length;
        const failCount = this.suite.steps.filter(s => s.status === 'fail').length;
        const skipCount = this.suite.steps.filter(s => s.status === 'skip').length;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${this.suite.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 { color: #333; margin-bottom: 10px; }
        .summary {
            display: flex;
            gap: 20px;
            margin-top: 20px;
        }
        .stat {
            padding: 15px 20px;
            border-radius: 6px;
            flex: 1;
        }
        .stat.pass { background: #d4edda; color: #155724; }
        .stat.fail { background: #f8d7da; color: #721c24; }
        .stat.skip { background: #fff3cd; color: #856404; }
        .stat-value { font-size: 32px; font-weight: bold; }
        .stat-label { font-size: 14px; margin-top: 5px; }
        
        .step {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .step-name {
            font-size: 16px;
            font-weight: 600;
            color: #333;
        }
        .step-duration {
            font-size: 12px;
            color: #666;
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .step-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            margin-left: 10px;
        }
        .step-status.pass { background: #d4edda; color: #155724; }
        .step-status.fail { background: #f8d7da; color: #721c24; }
        .step-status.skip { background: #fff3cd; color: #856404; }
        
        .step-details {
            margin-top: 10px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 13px;
            font-family: 'Courier New', monospace;
        }
        .step-error {
            margin-top: 10px;
            padding: 10px;
            background: #fff5f5;
            border-left: 3px solid #dc3545;
            font-size: 13px;
            color: #721c24;
        }
        .screenshot {
            margin-top: 10px;
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
        }
        .screenshot:hover { opacity: 0.9; }
        
        /* Modal for full-size screenshots */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            cursor: pointer;
        }
        .modal img {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 95%;
            max-height: 95%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 ${this.suite.name}</h1>
            <p>Started: ${this.suite.startTime.toLocaleString()}</p>
            <p>Duration: ${(duration / 1000).toFixed(2)}s</p>
            
            <div class="summary">
                <div class="stat pass">
                    <div class="stat-value">${passCount}</div>
                    <div class="stat-label">Passed</div>
                </div>
                <div class="stat fail">
                    <div class="stat-value">${failCount}</div>
                    <div class="stat-label">Failed</div>
                </div>
                <div class="stat skip">
                    <div class="stat-value">${skipCount}</div>
                    <div class="stat-label">Skipped</div>
                </div>
            </div>
        </div>

        ${this.suite.steps.map((step, i) => `
            <div class="step">
                <div class="step-header">
                    <div>
                        <span class="step-name">${i + 1}. ${step.name}</span>
                        <span class="step-status ${step.status}">${step.status.toUpperCase()}</span>
                    </div>
                    <span class="step-duration">${step.duration}ms</span>
                </div>
                
                ${step.details ? `
                    <div class="step-details">
                        <pre>${JSON.stringify(step.details, null, 2)}</pre>
                    </div>
                ` : ''}
                
                ${step.error ? `
                    <div class="step-error">
                        <strong>Error:</strong> ${step.error}
                    </div>
                ` : ''}
                
                ${step.screenshot ? `
                    <img src="${path.relative(path.dirname(outputPath), step.screenshot)}" 
                         class="screenshot" 
                         alt="Screenshot for ${step.name}"
                         onclick="showModal(this.src)">
                ` : ''}
            </div>
        `).join('')}
    </div>

    <div class="modal" id="modal" onclick="hideModal()">
        <img id="modal-img" src="" alt="Full size screenshot">
    </div>

    <script>
        function showModal(src) {
            document.getElementById('modal-img').src = src;
            document.getElementById('modal').style.display = 'block';
        }
        function hideModal() {
            document.getElementById('modal').style.display = 'none';
        }
    </script>
</body>
</html>
        `.trim();

        fs.writeFileSync(outputPath, html);
        console.log(`\n📊 HTML Report generated: ${outputPath}`);
        return outputPath;
    }
}
