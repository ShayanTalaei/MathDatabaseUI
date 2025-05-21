const fs = require('fs');
const path = require('path');


function computeNodeLevels(nodes, links) {
  nodes.forEach(node => {
    node.level = 0;
    node.inDegree = 0;
    node.outDegree = 0;
  });

  const idToNode = new Map(nodes.map(n => [n.id, n]));
  const validLinks = [];
  links.forEach(link => {
    const src = idToNode.get(link.source);
    const tgt = idToNode.get(link.target);
    if (src && tgt) {
      link.source = src;
      link.target = tgt;
      src.outDegree++;
      tgt.inDegree++;
      validLinks.push(link);
    }
  });
  links.length = 0;
  validLinks.forEach(l => links.push(l));

  const rootNodes = nodes.filter(n => n.inDegree === 0);
  let current = rootNodes.length ? rootNodes.slice() : nodes.slice();
  const visited = new Set(current.map(n => n.id));
  current.forEach(n => { n.level = 0; });
  let level = 0;
  while (current.length) {
    const next = [];
    current.forEach(node => {
      validLinks.forEach(link => {
        if (link.source === node && !visited.has(link.target.id)) {
          link.target.level = level + 1;
          visited.add(link.target.id);
          next.push(link.target);
        }
      });
    });
    current = next;
    level++;
  }
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    validLinks.forEach(({source, target}) => {
      if (target.level <= source.level) {
        target.level = Math.min(nodes.length, source.level + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return true;
}

const file = path.join(__dirname, 'data/2411.08218.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('start');
const ok = computeNodeLevels(data.nodes, data.links);
console.log('done');
console.log('Nodes:', data.nodes.length, 'Links:', data.links.length, 'ok:', ok);

