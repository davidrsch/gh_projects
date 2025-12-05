import * as fs from 'fs';
import * as path from 'path';

export interface Screenshot {
    path: string;
    label: string;
    timestamp: Date;
}

export interface TestStep {
    name: string;
    description: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    screenshots: Screenshot[];
    error?: string;
    details?: any;
    assertions?: string[];
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
    private currentScreenshots: Screenshot[] = [];
    private currentAssertions: string[] = [];

    constructor(suiteName: string) {
        this.suite = {
            name: suiteName,
            startTime: new Date(),
            steps: []
        };
    }

    startStep(name: string, description: string = '') {
        this.stepStartTime = Date.now();
        this.currentScreenshots = [];
        this.currentAssertions = [];
        console.log(`▶️  ${name}`);
        if (description) console.log(`   ${description}`);
    }

    addScreenshot(screenshotPath: string, label: string) {
        this.currentScreenshots.push({
            path: screenshotPath,
            label,
            timestamp: new Date()
        });
    }

    addAssertion(assertion: string) {
        this.currentAssertions.push(assertion);
    }

    endStep(name: string, status: 'pass' | 'fail' | 'skip', details?: any, screenshot?: string, error?: string, description: string = '') {
        const duration = Date.now() - this.stepStartTime;

        // If a final screenshot was passed, add it
        if (screenshot) {
            this.addScreenshot(screenshot, 'final');
        }

        this.suite.steps.push({
            name,
            description,
            status,
            duration,
            screenshots: [...this.currentScreenshots],
            error,
            details,
            assertions: [...this.currentAssertions]
        });

        const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
        console.log(`${icon} ${name} (${duration}ms) - ${this.currentScreenshots.length} screenshots`);
    }

    async generate(outputPath: string) {
        this.suite.endTime = new Date();
        const duration = this.suite.endTime.getTime() - this.suite.startTime.getTime();

        const passCount = this.suite.steps.filter(s => s.status === 'pass').length;
        const failCount = this.suite.steps.filter(s => s.status === 'fail').length;
        const skipCount = this.suite.steps.filter(s => s.status === 'skip').length;
        const totalScreenshots = this.suite.steps.reduce((sum, s) => sum + s.screenshots.length, 0);

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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: #252526;
            padding: 30px;
            border-radius: 8px;
            border: 1px solid #3c3c3c;
            margin-bottom: 20px;
        }
        h1 { color: #fff; margin-bottom: 10px; font-size: 28px; }
        .meta { color: #888; font-size: 14px; margin-bottom: 15px; }
        .summary {
            display: flex;
            gap: 15px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .stat {
            padding: 20px 25px;
            border-radius: 8px;
            min-width: 120px;
            text-align: center;
        }
        .stat.pass { background: #1a4d2e; border: 1px solid #2d6a4f; }
        .stat.fail { background: #4d1a1a; border: 1px solid #6a2d2d; }
        .stat.skip { background: #4d4d1a; border: 1px solid #6a6a2d; }
        .stat.info { background: #1a3d4d; border: 1px solid #2d5a6a; }
        .stat-value { font-size: 36px; font-weight: bold; }
        .stat-label { font-size: 12px; text-transform: uppercase; margin-top: 5px; opacity: 0.8; }
        
        .step {
            background: #252526;
            border-radius: 8px;
            border: 1px solid #3c3c3c;
            margin-bottom: 20px;
            overflow: hidden;
        }
        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: #2d2d2d;
            border-bottom: 1px solid #3c3c3c;
        }
        .step-info { flex: 1; }
        .step-name {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
        }
        .step-desc {
            font-size: 13px;
            color: #888;
            margin-top: 4px;
        }
        .step-meta {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .step-duration {
            font-size: 12px;
            color: #888;
            background: #3c3c3c;
            padding: 6px 12px;
            border-radius: 4px;
        }
        .step-status {
            padding: 6px 16px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .step-status.pass { background: #1a4d2e; color: #52c41a; }
        .step-status.fail { background: #4d1a1a; color: #ff4d4f; }
        .step-status.skip { background: #4d4d1a; color: #faad14; }
        
        .step-body { padding: 20px; }
        
        .assertions {
            background: #1a1a1a;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .assertions h4 { 
            color: #888; 
            font-size: 12px; 
            text-transform: uppercase; 
            margin-bottom: 10px;
        }
        .assertion {
            padding: 6px 0;
            font-size: 13px;
            color: #a0a0a0;
            border-bottom: 1px solid #2d2d2d;
        }
        .assertion:last-child { border-bottom: none; }
        .assertion.pass::before { content: '✓ '; color: #52c41a; }
        
        .details {
            background: #1a1a1a;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            overflow-x: auto;
        }
        .details pre {
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 12px;
            color: #d4d4d4;
        }
        
        .error {
            background: #3d1a1a;
            border-left: 4px solid #ff4d4f;
            padding: 15px;
            border-radius: 0 6px 6px 0;
            margin-bottom: 15px;
        }
        .error strong { color: #ff4d4f; }
        
        .screenshots {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }
        .screenshot-card {
            background: #1a1a1a;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #3c3c3c;
        }
        .screenshot-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .screenshot-card img:hover { opacity: 0.8; }
        .screenshot-label {
            padding: 10px 12px;
            font-size: 12px;
            color: #888;
            background: #2d2d2d;
        }
        .screenshot-time {
            font-size: 10px;
            color: #666;
            margin-top: 2px;
        }
        
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            cursor: pointer;
        }
        .modal img {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            max-width: 95%; max-height: 95%;
            border-radius: 4px;
        }
        .modal-close {
            position: absolute;
            top: 20px; right: 30px;
            font-size: 40px;
            color: #fff;
            cursor: pointer;
        }

        .no-screenshots {
            color: #666;
            font-style: italic;
            padding: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 ${this.suite.name}</h1>
            <div class="meta">
                <div>Started: ${this.suite.startTime.toLocaleString()}</div>
                <div>Duration: ${(duration / 1000).toFixed(2)}s</div>
            </div>
            
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
                <div class="stat info">
                    <div class="stat-value">${totalScreenshots}</div>
                    <div class="stat-label">Screenshots</div>
                </div>
            </div>
        </div>

        ${this.suite.steps.map((step, i) => `
            <div class="step">
                <div class="step-header">
                    <div class="step-info">
                        <div class="step-name">${i + 1}. ${step.name}</div>
                        ${step.description ? `<div class="step-desc">${step.description}</div>` : ''}
                    </div>
                    <div class="step-meta">
                        <span class="step-duration">${step.duration}ms</span>
                        <span class="step-status ${step.status}">${step.status}</span>
                    </div>
                </div>
                
                <div class="step-body">
                    ${step.assertions && step.assertions.length > 0 ? `
                        <div class="assertions">
                            <h4>Assertions (${step.assertions.length})</h4>
                            ${step.assertions.map(a => `<div class="assertion pass">${a}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${step.details ? `
                        <div class="details">
                            <pre>${JSON.stringify(step.details, null, 2)}</pre>
                        </div>
                    ` : ''}
                    
                    ${step.error ? `
                        <div class="error">
                            <strong>Error:</strong> ${step.error}
                        </div>
                    ` : ''}
                    
                    ${step.screenshots.length > 0 ? `
                        <div class="screenshots">
                            ${step.screenshots.map(s => `
                                <div class="screenshot-card">
                                    <img src="${path.basename(s.path)}" 
                                         alt="${s.label}"
                                         onclick="showModal(this.src)">
                                    <div class="screenshot-label">
                                        📸 ${s.label}
                                        <div class="screenshot-time">${s.timestamp.toLocaleTimeString()}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="no-screenshots">No screenshots for this step</div>'}
                </div>
            </div>
        `).join('')}
    </div>

    <div class="modal" id="modal" onclick="hideModal()">
        <span class="modal-close">&times;</span>
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
        document.addEventListener('keydown', e => { if(e.key === 'Escape') hideModal(); });
    </script>
</body>
</html>
        `.trim();

        fs.writeFileSync(outputPath, html);
        console.log(`\n📊 HTML Report generated: ${outputPath}`);
        console.log(`   Total screenshots: ${totalScreenshots}`);
        return outputPath;
    }
}
