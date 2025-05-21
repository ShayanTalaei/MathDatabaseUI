const fs = require('fs');
const path = require('path');
const { sanitizeLaTeX } = require('./main.js');

function checkEnvironments(text) {
  const regex = /\\(begin|end)\{([^}]+)\}/g;
  const stack = [];
  const errors = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, type, name] = match;
    if (type === 'begin') {
      stack.push(name);
    } else {
      const last = stack.pop();
      if (last !== name) {
        errors.push(`mismatch: expected end ${last || 'none'} but got ${name}`);
      }
    }
  }
  if (stack.length) {
    errors.push(`unclosed environment(s): ${stack.join(', ')}`);
  }
  return errors;
}

function testFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const snippets = [];
  data.nodes.forEach(n => {
    if (n.description) snippets.push(n.description);
    if (Array.isArray(n.context)) snippets.push(...n.context);
    if (Array.isArray(n.proofs)) n.proofs.forEach(p => snippets.push(p.text));
  });
  let fail = false;
  snippets.forEach((txt, idx) => {
    const cleaned = sanitizeLaTeX(txt);
    const errs = checkEnvironments(cleaned);
    if (errs.length) {
      fail = true;
      console.log(`Errors in snippet ${idx} of ${path.basename(file)}:`);
      console.log(errs.join('; '));
    }
  });
  return !fail;
}

const dataDir = path.join(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

let allOk = true;
files.forEach(f => {
  const ok = testFile(path.join(dataDir, f));
  if (!ok) allOk = false;
});

if (!allOk) {
  console.error('Some snippets failed environment checks');
  process.exit(1);
} else {
  console.log('All snippets passed environment checks');
}
