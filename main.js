// main.js
console.log("🔥 main.js loaded");

const isBrowser = typeof document !== 'undefined';
let svg, popup, titleEl, ulEl, closeBtn, width, height, dragHandle;
if (isBrowser) {
  svg       = d3.select('#graph');
  popup     = d3.select('#node-popup');
  titleEl   = d3.select('#popup-title');
  ulEl      = d3.select('#popup-sections');
  closeBtn  = d3.select('#close-popup');
  dragHandle = popup;
  const rect = svg.node().getBoundingClientRect();
  width  = rect.width;
  height = rect.height;
}

// load button
if (isBrowser) {
  const loadBtn = d3.select('#load-btn');
  const searchInput = d3.select('#paper-search');

  function loadGraph() {
    const pid = searchInput.property('value');
    const url = `./data/${pid}.json?ts=${Date.now()}`;
    console.log('fetching:', url);
    if (!pid) return alert('Please enter a paper ID.');
    d3.json(url)
      .then(data => {
        console.log('Nodes:', data.nodes);
        console.log('Links:', data.links);
        renderGraph(data.nodes, data.links);
      })
      .catch(err => {
        console.error(err);
        alert(`Failed to load data/${pid}.json (see console).`);
      });
  }

  loadBtn.on('click', loadGraph);
  loadBtn.on('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadGraph(); }
  });
  searchInput.on('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadGraph(); }
  });
}

function renderGraph(nodes, links) {
  svg.selectAll('*').remove();

  const container = svg.append('g');
  const zoom = d3.zoom()
    .scaleExtent([0.1, 5])
    .on('zoom', e => container.attr('transform', e.transform));
  svg.call(zoom);

  svg.append('defs').append('marker')
    .selectAll('marker')
    .data([
      {id: 'arrow-blue', color: 'steelblue'},
      {id: 'arrow-red',  color: 'firebrick'}
    ])
    .enter().append('marker')
      .attr('id', d => d.id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', d => d.color)
        .attr('stroke', 'none');

  computeNodeLevels(nodes, links);

  const levelExtent = d3.extent(nodes, d => d.level);
  const levelScale = d3.scaleLinear()
    .domain(levelExtent)
    .range([50, height - 50]);

  // initial x position spacing by level
  const groups = d3.group(nodes, d => d.level);
  groups.forEach((vals, lvl) => {
    const step = width / (vals.length + 1);
    vals.forEach((n,i) => {
      n._x = step * (i + 1);
      n._y = levelScale(lvl);
    });
  });

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.5))
    .force('x', d3.forceX(d => d._x).strength(1))
    .force('y', d3.forceY(d => d._y).strength(1))
    .force('collision', d3.forceCollide().radius(50))
    .stop();

  for (let i=0; i<200; i++) sim.tick();


  const link = container.append('g')
    .selectAll('path').data(links).enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', d => d.type && d.type.startsWith('proof') ? 'firebrick' : 'steelblue')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', d => d.type && d.type.includes('implicit') ? '4 2' : null)
    .attr('marker-end', d => d.type && d.type.startsWith('proof') ? 'url(#arrow-red)' : 'url(#arrow-blue)');

  const nodeG = container.append('g')
    .selectAll('g').data(nodes).enter()
    .append('g')
    .call(d3.drag()
      .on('drag', dragged))
    .on('click', showPopup);


  nodeG.append('rect')
    .attr('width', d => { d.width = 120; return d.width; })
    .attr('height', d => { d.height = 30; return d.height; })
    .attr('x', d => -d.width / 2)
    .attr('y', d => -d.height / 2)
    .attr('rx', 4)

    .attr('fill', d => (d.proofs && d.proofs.length ? '#55aa55' : '#4b9bff'));

  nodeG.append('text')
    .text(d => d.local_id ? `${d.id}:${d.local_id}` : d.id)
    .attr('text-anchor', 'middle')
    .attr('dy', 4)
    .style('font-size', '10px')
    .style('pointer-events', 'none');


  ticked();


  function ticked() {
    link.attr('d', d => {
      const {sx, sy, tx, ty} = edgePoints(d.source, d.target);
      const dx = tx - sx;
      const dy = ty - sy;
      const curve = 0.2;
      const mx = (sx + tx) / 2 + (-dy) * curve;
      const my = (sy + ty) / 2 + (dx) * curve;
      return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
    });

    nodeG.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  function edgePoints(a, b) {
    const start = intersectRect(a, b);
    const end   = intersectRect(b, a);
    return {sx: start.x, sy: start.y, tx: end.x, ty: end.y};
  }

  function intersectRect(node, other) {
    const dx = other.x - node.x;
    const dy = other.y - node.y;
    const w = node.width / 2;
    const h = node.height / 2;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    let x = node.x;
    let y = node.y;
    if (absDx * h > absDy * w) {
      x += dx > 0 ? w : -w;
      y += (dx === 0) ? 0 : (w * dy / absDx) * (dx > 0 ? 1 : -1);
    } else {
      x += (dy === 0) ? 0 : (h * dx / absDy) * (dy > 0 ? 1 : -1);
      y += dy > 0 ? h : -h;
    }
    return {x, y};
  }


  function dragged(e, d) {
    d.x = e.x;
    d.y = e.y;
    ticked();

  }
}

// Helper function to compute node hierarchy levels
function computeNodeLevels(nodes, links) {
  // Initial level setup
  nodes.forEach(node => {
    node.level = 0;         // Default level
    node.inDegree = 0;      // Count of incoming links
    node.outDegree = 0;     // Count of outgoing links
  });
  
  // Map node ids for quick lookup and filter out any links that reference
  // non-existent nodes to avoid errors in the D3 simulation.
  const idToNode = new Map(nodes.map(n => [n.id, n]));
  const validLinks = [];

  links.forEach(link => {
    const src = typeof link.source === 'object' ? idToNode.get(link.source.id) : idToNode.get(link.source);
    const tgt = typeof link.target === 'object' ? idToNode.get(link.target.id) : idToNode.get(link.target);

    if (src && tgt) {
      link.source = src;
      link.target = tgt;
      src.outDegree++;
      tgt.inDegree++;
      validLinks.push(link);
    }
  });

  // Replace original links array with the validated links only
  links.length = 0;
  validLinks.forEach(l => links.push(l));
  
  // Find root nodes (nodes with no incoming edges)
  const rootNodes = nodes.filter(node => node.inDegree === 0);


  // Perform a breadth-first traversal while tracking visited nodes so each
  // node is assigned a level only once. If there are no roots start from all
  // nodes to ensure coverage of strongly connected components.
  let currentNodes = rootNodes.length ? rootNodes.slice() : nodes.slice();
  const visited = new Set(currentNodes.map(n => n.id));
  currentNodes.forEach(n => { n.level = 0; });
  let level = 0;

  while (currentNodes.length > 0) {
    const nextNodes = [];
    currentNodes.forEach(node => {
      links.forEach(link => {
        if (link.source === node && !visited.has(link.target.id)) {
          link.target.level = level + 1;
          visited.add(link.target.id);
          nextNodes.push(link.target);
        }
      });
    });

    currentNodes = nextNodes;
    level++;
  }
  
  // If there are cycles, some nodes may not have been assigned levels.
  // Run a second pass to propagate levels along edges, but cap the number
  // of iterations to avoid infinite loops on cyclic graphs.
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

function sanitizeLaTeX(text, asMath=false) {
  if (!text) return '';
  let out = text
    .replace(/```(?:latex)?/g, '')
    .replace(/\\documentclass\{[^}]*\}|\\usepackage\{[^}]*}/g, '')
    .replace(/\\begin\{document\}|\\end\{document}/g, '')
    // list environments => bullet points
    .replace(/\\begin\{(?:enumerate|itemize)\*?\}/g, '')
    .replace(/\\end\{(?:enumerate|itemize)\*?\}/g, '')
    .replace(/\\item\s*/g, '\u2022 ')
    // common typos such as \beign{enumerate}
    .replace(/\\beign\s*\{/g, '\\begin{');

  const supported = [
    'equation','equation*','align','align*','alignat','alignat*','gather','gather*',
    'flalign','flalign*','multline','multline*','eqnarray','eqnarray*','array',
    'matrix','pmatrix','bmatrix','Bmatrix','vmatrix','Vmatrix','cases','split'
  ];
  out = out
    .replace(/\\begin\{([^}]+)\}/g, (m, env) => {
      return supported.includes(env) ? m : '';
    })
    .replace(/\\end\{([^}]+)\}/g, (m, env) => {
      return supported.includes(env) ? m : '';
    });

  // Show unresolved references in textual form
  out = out
    .replace(/\$(\\(?:eq)?ref\{[^}]+\})\$/g, '$1')
    .replace(/\\\((\\(?:eq)?ref\{[^}]+\})\\\)/g, '$1')
    .replace(/\\\[(\\(?:eq)?ref\{[^}]+\})\\\]/g, '$1')
    .replace(/\\(C?ref|eqref)\{([^}]+)\}/g,
      (_, cmd, lbl) => `\\text{\\textbackslash ${cmd}\{${lbl}\}}`);

  out = out.trim();
  if (asMath && !/[\$\\begin\[]/.test(out)) {
    out = `\\(${out}\\)`;
  }
  out = out
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return out;
}

// popup logic
function showPopup(event, d) {
  // title
  titleEl.text(`${d.name} (${d.type})`);

  // build an array of sections to render
  const sections = [];
  // description
  sections.push({
    title: 'Description',
    content: sanitizeLaTeX(d.description, d.type === 'equation'),
    initiallyCollapsed: false
  });
  // local_id
  if (d.local_id) {
    sections.push({
      title: 'Local ID',
      content: d.local_id,
      initiallyCollapsed: false
    });
  }
  // context
  if (d.context && d.context.length) {
    sections.push({
      title: 'Context',
      content: d.context.join('\n'),
      initiallyCollapsed: false
    });
  }
  // proofs
  if (d.proofs && d.proofs.length) {
    d.proofs.forEach((p,i) => {
      sections.push({
        title: `Proof (${p.origin})`,
        content: sanitizeLaTeX(p.text),
        grade: sanitizeLaTeX(p.grade),
        initiallyCollapsed: true // Proofs are initially collapsed
      });
    });
  }

  // inject into the UL
  ulEl.html('');
  sections.forEach((sec, idx) => {
    const li = ulEl.append('li');
    const headerEl = li.append('div')
      .attr('class', 'toggle-header' + (sec.initiallyCollapsed ? ' collapsed' : ''))
      .text(sec.title)
      .on('click', function() {
        const header = d3.select(this);
        const content = li.select('.toggle-content');
        const isHidden = content.classed('hidden');
        
        // Toggle collapse state
        content.classed('hidden', !isHidden);
        header.classed('collapsed', !isHidden);
      });
    
    const contentDiv = li.append('div')
      .attr('class', 'toggle-content' + (sec.initiallyCollapsed ? ' hidden' : ''))
      .text(sec.content);

    if (sec.grade) {
      const subUl = contentDiv.append('ul').attr('class', 'toggle-list');
      const subLi = subUl.append('li');
      subLi.append('div')
        .attr('class', 'toggle-header collapsed')
        .text('Grading')
        .on('click', function() {
          const header = d3.select(this);
          const content = d3.select(this.parentNode).select('.toggle-content');

          const isHidden = content.classed('hidden');
          content.classed('hidden', !isHidden);
          header.classed('collapsed', !isHidden);
        });
      subLi.append('div')
        .attr('class', 'toggle-content hidden')
        .text(sec.grade);
    }
  });

  if (window.MathJax) {
    MathJax.typesetPromise();
  }

  // position in the centre of the viewport and show
  popup.classed('hidden', false);
  const rect = popup.node().getBoundingClientRect();
  const left = (window.innerWidth  - rect.width)  / 2 + window.scrollX;
  const top  = (window.innerHeight - rect.height) / 2 + window.scrollY;
  popup.style('left', `${left}px`).style('top', `${top}px`);
}

// close popup
if (isBrowser) {
  closeBtn.on('click', () => {
    popup.classed('hidden', true);
  });

  // enable dragging of the popup
  let offsetX = 0, offsetY = 0;
  dragHandle.call(d3.drag()
    .on('start', (event) => {
      const rect = popup.node().getBoundingClientRect();
      offsetX = event.x - rect.left;
      offsetY = event.y - rect.top;
    })
    .on('drag', (event) => {
      popup.style('left', `${event.x - offsetX}px`)
           .style('top',  `${event.y - offsetY}px`);
    }));
}

// Export for Node.js testing
if (typeof module !== 'undefined') {
  module.exports = { computeNodeLevels, sanitizeLaTeX };
}
