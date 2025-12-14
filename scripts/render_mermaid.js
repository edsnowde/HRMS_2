const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const mdPath = path.join(__dirname, '..', 'docs', 'WORKFLOW.md');
const mmdPath = path.join(__dirname, '..', 'docs', 'WORKFLOW.mmd');
const svgPath = path.join(__dirname, '..', 'docs', 'WORKFLOW.svg');

if (!fs.existsSync(mdPath)) {
  console.error('docs/WORKFLOW.md not found');
  process.exit(2);
}

const md = fs.readFileSync(mdPath, 'utf8');
const re = /```mermaid\n([\s\S]*?)\n```/i;
const match = md.match(re);
if (!match) {
  console.error('No mermaid code block found in WORKFLOW.md');
  process.exit(3);
}

const mermaidSource = match[1];
fs.writeFileSync(mmdPath, mermaidSource, 'utf8');
console.log('Wrote', mmdPath);

try {
  // Use npx to avoid requiring a global installation.
  console.log('Rendering SVG using @mermaid-js/mermaid-cli...');
  execSync(`npx --yes @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${svgPath}"`, { stdio: 'inherit' });
  console.log('Rendered', svgPath);
} catch (err) {
  console.error('Rendering failed:', err.message || err);
  process.exit(4);
}

// Optionally tidy up the intermediate mmd file
// fs.unlinkSync(mmdPath);
process.exit(0);
