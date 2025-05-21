function computeNodeLevels(nodes, links) {
  nodes.forEach(node => {
    node.level = 0;
    node.inDegree = 0;
    node.outDegree = 0;
  });

  links.forEach(link => {
    link.source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
    link.target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
    if (link.source && link.target) {
      link.source.outDegree++;
      link.target.inDegree++;
    }
  });

  const rootNodes = nodes.filter(n => n.inDegree === 0);
  let currentNodes = (rootNodes.length ? rootNodes : nodes).slice();
  const visited = new Set(currentNodes.map(n => n.id));
  let level = 0;

  while (currentNodes.length > 0) {
    currentNodes.forEach(node => {
      node.level = level;
    });

    const nextNodes = [];
    currentNodes.forEach(node => {
      links.forEach(link => {
        if ((typeof link.source === 'object' && link.source.id === node.id) ||
            (typeof link.source === 'string' && link.source === node.id)) {
          const targetNode = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
          if (targetNode && !visited.has(targetNode.id)) {
            visited.add(targetNode.id);
            nextNodes.push(targetNode);
          }
        }
      });
    });

    currentNodes = nextNodes;
    level++;
  }

  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    links.forEach(link => {
      const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
      const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
      if (source && target && target.level <= source.level) {
        target.level = Math.min(nodes.length, source.level + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }

  const maxLevel = Math.max(...nodes.map(n => n.level));
  nodes.forEach(n => {
    if (n.proofs && n.proofs.length) {
      n.level = maxLevel + 1;
    } else if (n.inDegree === 0 && n.outDegree === 0) {
      n.level = -1;
    }
  });

  return nodes;
}

if (typeof module !== 'undefined') {
  module.exports = { computeNodeLevels };
}

