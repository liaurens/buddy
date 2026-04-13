import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function devReporterPlugin(): Plugin {
  return {
    name: 'vite-plugin-dev-reporter',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/__dev_report_bug') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const { description, code, url, date, type = 'bug' } = data;

              const reportContent = `
## [${type.toUpperCase()}] Report - ${new Date(date).toLocaleString()}
**URL:** ${url}

**Description:**
${description}

**Selected Element Code:**
\`\`\`html
${code}
\`\`\`
---
`;

              const filePath = path.resolve(process.cwd(), 'dev-reports.md');
              fs.appendFileSync(filePath, reportContent, 'utf8');

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              console.error('Error writing dev report:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to write report' }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}
