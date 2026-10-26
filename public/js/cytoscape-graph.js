/**
 * Cytoscape.js Relationship Graph Renderer
 * Visualizes cases, suspects, investigators, evidence, locations, and findings
 */

function initRelationshipGraph(containerId, dataUrl) {
  const container = document.getElementById(containerId);
  if (!container) return;

  fetch(dataUrl)
    .then(res => res.json())
    .then(data => {
      const cy = cytoscape({
        container: container,
        elements: {
          nodes: data.nodes || [],
          edges: data.edges || []
        },
        style: [
          // Base Node Style
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'text-wrap': 'wrap',
              'text-max-width': 120,
              'color': '#f8fafc',
              'font-size': '13px',
              'font-weight': '600',
              'text-valign': 'bottom',
              'text-margin-y': 8,
              'background-color': '#475569',
              'width': 50,
              'height': 50,
              'border-width': 3,
              'border-color': '#1e293b'
            }
          },
          // Case Node
          {
            selector: 'node[type = "case"]',
            style: {
              'background-color': '#2563eb',
              'border-color': '#60a5fa',
              'shape': 'round-rectangle',
              'width': 64,
              'height': 64
            }
          },
          // Suspect Node
          {
            selector: 'node[type = "suspect"]',
            style: {
              'background-color': '#dc2626',
              'border-color': '#f87171',
              'shape': 'ellipse',
              'width': 58,
              'height': 58
            }
          },
          // Evidence Node
          {
            selector: 'node[type = "evidence"]',
            style: {
              'background-color': '#d97706',
              'border-color': '#fbbf24',
              'shape': 'diamond',
              'width': 54,
              'height': 54
            }
          },
          // Investigator Node
          {
            selector: 'node[type = "investigator"]',
            style: {
              'background-color': '#7c3aed',
              'border-color': '#a78bfa',
              'shape': 'hexagon',
              'width': 54,
              'height': 54
            }
          },
          // Location Node
          {
            selector: 'node[type = "location"]',
            style: {
              'background-color': '#059669',
              'border-color': '#34d399',
              'shape': 'triangle',
              'width': 48,
              'height': 48
            }
          },
          // Finding Node
          {
            selector: 'node[type = "finding"]',
            style: {
              'background-color': '#0891b2',
              'border-color': '#38bdf8',
              'shape': 'star',
              'width': 44,
              'height': 44
            }
          },
          // Edge Style
          {
            selector: 'edge',
            style: {
              'width': 2.5,
              'line-color': '#334155',
              'target-arrow-color': '#475569',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'label': 'data(label)',
              'color': '#94a3b8',
              'font-size': '11px',
              'text-background-color': '#090e18',
              'text-background-opacity': 0.85,
              'text-background-padding': 3,
              'text-rotation': 'autorotate'
            }
          },
          // Selected element highlight
          {
            selector: ':selected',
            style: {
              'border-color': '#38bdf8',
              'border-width': 5,
              'line-color': '#38bdf8',
              'target-arrow-color': '#38bdf8'
            }
          }
        ],
        layout: {
          name: 'cose',
          animate: true,
          randomize: false,
          componentSpacing: 100,
          nodeOverlap: 20,
          idealEdgeLength: 120,
          padding: 40
        }
      });

      // Node selection click handler to populate inspector
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const data = node.data();
        const inspector = document.getElementById('graph-inspector');
        if (!inspector) return;

        let html = `
          <div class="forensic-card">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="badge badge-open">${(data.type || 'ENTITY').toUpperCase()}</span>
              ${data.url ? `<a href="${data.url}" class="btn btn-sm btn-outline"><i class="bi bi-box-arrow-up-right"></i> Open File</a>` : ''}
            </div>
            <h4 class="text-white mb-2">${data.name || data.label}</h4>
        `;

        if (data.type === 'case') {
          html += `
            <p class="text-muted mb-1"><strong>Status:</strong> ${data.status}</p>
            <p class="text-muted mb-1"><strong>Priority:</strong> ${data.priority}</p>
            <p class="text-muted mb-0"><strong>Classification:</strong> ${data.classification}</p>
          `;
        } else if (data.type === 'suspect') {
          html += `
            <p class="text-muted mb-1"><strong>Status:</strong> ${data.status}</p>
            <p class="text-muted mb-1"><strong>Risk Level:</strong> <span class="text-danger">${data.riskLevel}</span></p>
            <p class="text-muted mb-0"><strong>Alias:</strong> "${data.alias || 'None'}"</p>
          `;
        } else if (data.type === 'evidence') {
          html += `
            <p class="text-muted mb-1"><strong>File Type:</strong> ${data.fileType.toUpperCase()}</p>
            <p class="text-muted mb-1"><strong>Integrity:</strong> ${data.integrity}</p>
            <p class="text-muted mb-0"><strong>SHA-256:</strong> <span class="sha256-code">${(data.hash || '').slice(0, 20)}...</span></p>
          `;
        } else if (data.type === 'investigator') {
          html += `
            <p class="text-muted mb-1"><strong>Badge ID:</strong> ${data.badge}</p>
            <p class="text-muted mb-0"><strong>Department:</strong> ${data.department}</p>
          `;
        } else if (data.type === 'finding') {
          html += `
            <p class="text-muted mb-1"><strong>Confidence:</strong> ${Math.round((data.confidence || 0) * 100)}%</p>
            <p class="text-muted mb-0"><strong>Review Status:</strong> ${data.status}</p>
          `;
        }

        html += `</div>`;
        inspector.innerHTML = html;
      });

      // Quick toolbar buttons
      document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        cy.zoom(cy.zoom() * 1.25);
      });
      document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        cy.zoom(cy.zoom() * 0.8);
      });
      document.getElementById('btn-fit-graph')?.addEventListener('click', () => {
        cy.fit(null, 50);
      });
      document.getElementById('btn-re-layout')?.addEventListener('click', () => {
        cy.layout({ name: 'cose', animate: true }).run();
      });
    })
    .catch(err => {
      console.error('Error loading graph:', err);
      container.innerHTML = `<div class="p-4 text-center text-danger">Failed to load relationship graph data.</div>`;
    });
}
