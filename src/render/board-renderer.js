import { PieceType, PlayerSide, MoveType } from '../core/enums.js';

/**
 * Canvas 2D Board Renderer for Aadu Puli Aatam.
 * Handles high-DPI scaling, smooth animations, node picking, and responsive board layout.
 */
export class BoardRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../core/board-graph.js').BoardGraph} graph
   */
  constructor(canvas, graph) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.graph = graph;

    // Layout metrics (computed dynamically on resize)
    this.width = 600;
    this.height = 600;
    this.dpr = 1;
    this.nodeScreenCoords = []; // Array of {x, y, radius}

    // Colors
    this.colors = {
      boardMat: '#251A13',
      boardBorder: '#5C3E21',
      boardGoldRim: '#D4AF37',
      gridLine: '#D2B48C',
      gridLineGlow: 'rgba(210, 180, 140, 0.25)',
      nodeEmpty: 'rgba(180, 140, 100, 0.35)',
      nodeEmptyBorder: '#8C6A48',
      tigerFill: '#E8A317',
      tigerBorder: '#FFF0AA',
      tigerGlow: 'rgba(232, 163, 23, 0.65)',
      tigerDark: '#8B4500',
      goatFill: '#F5EDDF',
      goatBorder: '#FFFFFF',
      goatGlow: 'rgba(245, 237, 223, 0.5)',
      goatDark: '#7A6E5D',
      legalMove: '#4CAF50',
      legalMoveGlow: 'rgba(76, 175, 80, 0.6)',
      captureMove: '#E53935',
      captureMoveGlow: 'rgba(229, 57, 53, 0.8)',
      selectedHalo: '#FFD700',
      textDark: '#1E1712',
      textLight: '#F5EDDF'
    };

    // State bindings
    this.selectedNodeId = -1;
    this.highlightMoves = [];
    this.hoverNodeId = -1;
    this.lastMove = null;
    this.showNodeLabels = false;
    this.animTime = 0;

    // Illustrated Piece Assets Cache
    this.tigerImg = new Image();
    this.tigerImg.src = 'assets/pieces/tiger-piece.png';
    this.tigerImgLoaded = false;
    this.tigerImg.onload = () => { this.tigerImgLoaded = true; };

    this.goatImg = new Image();
    this.goatImg.src = 'assets/pieces/goat-piece.png';
    this.goatImgLoaded = false;
    this.goatImg.onload = () => { this.goatImgLoaded = true; };

    this.onNodeClicked = null;

    this._bindEvents();
    this.resize();
  }

  _bindEvents() {
    const handlePointer = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

      const x = (clientX - rect.left) * (this.canvas.width / (rect.width * this.dpr));
      const y = (clientY - rect.top) * (this.canvas.height / (rect.height * this.dpr));

      return { x, y };
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = handlePointer(e);
      const picked = this.pickNode(x, y);
      if (picked !== this.hoverNodeId) {
        this.hoverNodeId = picked;
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverNodeId = -1;
    });

    const triggerClick = (e) => {
      const { x, y } = handlePointer(e);
      const picked = this.pickNode(x, y);
      if (this.onNodeClicked) {
        this.onNodeClicked(picked);
      }
    };

    this.canvas.addEventListener('click', (e) => {
      triggerClick(e);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      triggerClick(e);
    }, { passive: false });
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const parentWidth = rect.width > 0 ? rect.width : (window.innerWidth - 300);
    const parentHeight = rect.height > 0 ? rect.height : (window.innerHeight - 90);

    // Compute square board dimension to maximize view on desktop and mobile
    let targetSize = Math.min(parentWidth, parentHeight);
    if (targetSize <= 0) {
      targetSize = Math.min(window.innerWidth * 0.65, window.innerHeight * 0.82);
    }

    // Dynamic scale up to 960px on wide monitors, keeping 280px minimum on small screens
    const size = Math.floor(Math.max(280, Math.min(targetSize, 960)));

    this.dpr = window.devicePixelRatio || 1;
    this.width = size;
    this.height = size;

    this.canvas.width = size * this.dpr;
    this.canvas.height = size * this.dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this._computeNodeCoords();
  }

  _computeNodeCoords() {
    this.nodeScreenCoords = [];
    const paddingX = this.width * 0.12;
    const paddingTop = this.height * 0.12;
    const paddingBottom = this.height * 0.10;
    const usableW = this.width - paddingX * 2;
    const usableH = this.height - paddingTop - paddingBottom;

    // Node graph has x from -3.0 to +3.0 (span 6.0), y from 0.0 (base) to 4.0 (apex)
    const minX = -3.0;
    const maxX = 3.0;
    const minY = 0.0;
    const maxY = 4.0;

    const baseRadius = Math.max(14, this.width * 0.038);

    for (let i = 0; i < this.graph.nodeCount; i++) {
      const node = this.graph.getNode(i);
      const normX = (node.x - minX) / (maxX - minX);
      const normY = (maxY - node.y) / (maxY - minY); // Invert Y so apex is at top

      const sx = paddingX + normX * usableW;
      const sy = paddingTop + normY * usableH;

      this.nodeScreenCoords.push({
        id: i,
        x: sx,
        y: sy,
        radius: baseRadius
      });
    }
  }

  pickNode(canvasX, canvasY) {
    let closestId = -1;
    let minDistanceSq = Infinity;
    const hitRadiusPadding = 18;

    for (let i = 0; i < this.nodeScreenCoords.length; i++) {
      const n = this.nodeScreenCoords[i];
      const dx = canvasX - n.x;
      const dy = canvasY - n.y;
      const distSq = dx * dx + dy * dy;
      const maxDist = (n.radius + hitRadiusPadding);

      if (distSq <= maxDist * maxDist && distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestId = i;
      }
    }

    return closestId;
  }

  render(state, selectedNodeId = -1, highlightMoves = [], lastMove = null) {
    this.animTime += 0.03;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Draw Board Mat Background
    this._drawBoardMat(ctx);

    // 2. Draw Kolam Grid Lines
    this._drawGridLines(ctx);

    // 3. Draw Last Move Trail / Beacon
    if (lastMove) {
      this._drawLastMoveIndicator(ctx, lastMove);
    }

    // 4. Draw Active Leap Rays / Hints
    this._drawMoveTrajectories(ctx, highlightMoves);

    // 5. Draw Empty Nodes & Sockets
    this._drawNodes(ctx, state);

    // 6. Draw Pieces (Tigers and Goats)
    this._drawPieces(ctx, state, selectedNodeId);

    // 7. Draw Legal Move & Capture Indicators
    this._drawHighlights(ctx, highlightMoves);

    // 8. Draw Node IDs if enabled
    if (this.showNodeLabels) {
      this._drawNodeLabels(ctx);
    }

    ctx.restore();
  }

  _drawLastMoveIndicator(ctx, move) {
    ctx.save();
    const pulse = 1.0 + 0.08 * Math.sin(this.animTime * 4);

    // Origin node (dashed gold ring)
    if (move.fromNode >= 0 && move.fromNode < this.nodeScreenCoords.length) {
      const fromNode = this.nodeScreenCoords[move.fromNode];
      ctx.strokeStyle = 'rgba(232, 163, 23, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(fromNode.x, fromNode.y, fromNode.radius * 1.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Destination node (solid glowing gold ring)
    if (move.toNode >= 0 && move.toNode < this.nodeScreenCoords.length) {
      const toNode = this.nodeScreenCoords[move.toNode];
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(toNode.x, toNode.y, toNode.radius * 1.3 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawNodeLabels(ctx) {
    ctx.save();
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(220, 199, 163, 0.75)';

    for (let i = 0; i < this.nodeScreenCoords.length; i++) {
      const n = this.nodeScreenCoords[i];
      ctx.fillText(i.toString(), n.x + n.radius * 1.1, n.y - n.radius * 0.8);
    }
    ctx.restore();
  }

  _drawBoardMat(ctx) {
    const w = this.width;
    const h = this.height;
    const r = 24;

    // Soft outer shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    // Wood / Leather Mat Gradient
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    bgGrad.addColorStop(0, '#352419');
    bgGrad.addColorStop(0.7, '#241710');
    bgGrad.addColorStop(1, '#180E0A');

    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, r);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Outer Brass / Gold Inlay Border
    ctx.strokeStyle = this.colors.boardBorder;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, r);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(16, 16, w - 32, h - 32, r - 6);
    ctx.stroke();

    // Corner Ornaments
    this._drawCornerOrnament(ctx, 24, 24);
    this._drawCornerOrnament(ctx, w - 24, 24);
    this._drawCornerOrnament(ctx, 24, h - 24);
    this._drawCornerOrnament(ctx, w - 24, h - 24);
  }

  _drawCornerOrnament(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawGridLines(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Subtle line glow
    ctx.shadowColor = this.colors.gridLineGlow;
    ctx.shadowBlur = 6;

    for (const line of this.graph.straightLines) {
      if (line.length < 2) continue;
      ctx.beginPath();
      const p0 = this.nodeScreenCoords[line[0]];
      ctx.moveTo(p0.x, p0.y);

      for (let i = 1; i < line.length; i++) {
        const p = this.nodeScreenCoords[line[i]];
        ctx.lineTo(p.x, p.y);
      }

      ctx.strokeStyle = this.colors.gridLine;
      ctx.lineWidth = Math.max(2.5, this.width * 0.0055);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawMoveTrajectories(ctx, moves) {
    if (!moves || moves.length === 0) return;

    ctx.save();
    for (const m of moves) {
      if (m.isCapture && m.fromNode >= 0 && m.toNode >= 0) {
        const from = this.nodeScreenCoords[m.fromNode];
        const to = this.nodeScreenCoords[m.toNode];
        const over = m.capturedGoatNode >= 0 ? this.nodeScreenCoords[m.capturedGoatNode] : null;

        ctx.strokeStyle = 'rgba(229, 57, 53, 0.4)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (over) {
          // Pulse halo around jumpable goat
          ctx.strokeStyle = 'rgba(229, 57, 53, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(over.x, over.y, over.radius * 1.35, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  _drawNodes(ctx, state) {
    for (let i = 0; i < this.nodeScreenCoords.length; i++) {
      const n = this.nodeScreenCoords[i];
      const piece = state ? state.getPiece(i) : PieceType.Empty;

      // Draw node marker (brass ring socket)
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = this.colors.nodeEmpty;
      ctx.fill();

      ctx.strokeStyle = this.colors.nodeEmptyBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      // If hovered and empty
      if (this.hoverNodeId === i && piece === PieceType.Empty) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 0.75, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  _drawPieces(ctx, state, selectedNodeId) {
    if (!state) return;

    for (let i = 0; i < this.graph.nodeCount; i++) {
      const piece = state.getPiece(i);
      if (piece === PieceType.Empty) continue;

      const n = this.nodeScreenCoords[i];
      const isSelected = (selectedNodeId === i);
      const isHovered = (this.hoverNodeId === i);

      if (piece === PieceType.Tiger) {
        this._drawTigerPiece(ctx, n.x, n.y, n.radius, isSelected, isHovered);
      } else if (piece === PieceType.Goat) {
        this._drawGoatPiece(ctx, n.x, n.y, n.radius, isSelected, isHovered);
      }
    }
  }

  _drawTigerPiece(ctx, x, y, radius, isSelected, isHovered) {
    ctx.save();
    const diameter = radius * 2.3;
    const r = diameter / 2;

    // 1. Selection Pulse Halo
    if (isSelected) {
      const pulse = 1.0 + 0.12 * Math.sin(this.animTime * 6);
      ctx.shadowColor = this.colors.selectedHalo;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = this.colors.selectedHalo;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.18 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Realistic Contact Shadow beneath piece
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    // 3. Render Illustrated Tiger Piece Asset
    if (this.tigerImgLoaded && this.tigerImg.complete) {
      ctx.drawImage(this.tigerImg, x - r, y - r, diameter, diameter);
    } else {
      // Fallback: Golden coin
      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      grad.addColorStop(0, '#FFD54F');
      grad.addColorStop(0.5, this.colors.tigerFill);
      grad.addColorStop(1, this.colors.tigerDark);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawGoatPiece(ctx, x, y, radius, isSelected, isHovered) {
    ctx.save();
    const diameter = radius * 2.15;
    const r = diameter / 2;

    // 1. Selection Pulse Halo
    if (isSelected) {
      const pulse = 1.0 + 0.12 * Math.sin(this.animTime * 6);
      ctx.shadowColor = '#52B760';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#52B760';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.18 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Realistic Contact Shadow beneath piece
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // 3. Render Illustrated Goat Piece Asset
    if (this.goatImgLoaded && this.goatImg.complete) {
      ctx.drawImage(this.goatImg, x - r, y - r, diameter, diameter);
    } else {
      // Fallback: Polished Ivory coin
      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.6, this.colors.goatFill);
      grad.addColorStop(1, '#B0A290');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawHighlights(ctx, moves) {
    if (!moves || moves.length === 0) return;

    ctx.save();
    const pulse = 1.0 + 0.12 * Math.sin(this.animTime * 5);

    for (const m of moves) {
      const targetId = m.toNode;
      if (targetId < 0 || targetId >= this.nodeScreenCoords.length) continue;
      const n = this.nodeScreenCoords[targetId];

      if (m.isCapture) {
        // Crimson capture crosshair and halo
        ctx.shadowColor = this.colors.captureMoveGlow;
        ctx.shadowBlur = 14;

        ctx.strokeStyle = this.colors.captureMove;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 1.2 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(229, 57, 53, 0.25)';
        ctx.fill();

        // Crosshairs
        const cross = n.radius * 0.6;
        ctx.beginPath();
        ctx.moveTo(n.x - cross, n.y);
        ctx.lineTo(n.x + cross, n.y);
        ctx.moveTo(n.x, n.y - cross);
        ctx.lineTo(n.x, n.y + cross);
        ctx.stroke();
      } else {
        // Emerald legal move ring
        ctx.shadowColor = this.colors.legalMoveGlow;
        ctx.shadowBlur = 12;

        ctx.strokeStyle = this.colors.legalMove;
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 1.15 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
