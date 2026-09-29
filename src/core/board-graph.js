/**
 * BoardNode and BoardGraph representation for Aadu Puli Aatam.
 * Represents the immutable topological graph of the 23-node board.
 */

export class BoardNode {
  /**
   * @param {number} id
   * @param {number} x
   * @param {number} y
   * @param {string} label
   */
  constructor(id, x, y, label) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.label = label;
  }
}

export class JumpPath {
  /**
   * @param {number} fromNode
   * @param {number} overNode
   * @param {number} toNode
   */
  constructor(fromNode, overNode, toNode) {
    this.fromNode = fromNode;
    this.overNode = overNode;
    this.toNode = toNode;
  }
}

export class BoardGraph {
  static StandardNodeCount = 23;

  /**
   * @param {BoardNode[]} nodes
   * @param {number[][]} straightLines
   */
  constructor(nodes, straightLines) {
    this.nodes = [...nodes].sort((a, b) => a.id - b.id);
    const n = this.nodes.length;
    this.nodeCount = n;

    this._adjacencyList = Array.from({ length: n }, () => []);
    this._adjacencyMatrix = Array.from({ length: n }, () => Array(n).fill(false));
    this._jumpsFromNode = Array.from({ length: n }, () => []);
    this._jumpLookup = new Map(); // key: `${from},${over}` -> to
    this._jumpedNodeLookup = new Map(); // key: `${from},${to}` -> over
    this.allJumpPaths = [];
    this.straightLines = [];

    for (const line of straightLines) {
      if (!line || line.length < 2) continue;
      this.straightLines.push([...line]);

      // Add single step edges along line
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const b = line[i + 1];
        this._addEdge(a, b);
      }

      // Add leap paths (jump over 1 node along collinear lines)
      for (let i = 0; i < line.length - 2; i++) {
        const from = line[i];
        const over = line[i + 1];
        const to = line[i + 2];

        this._addJump(from, over, to);
        this._addJump(to, over, from);
      }
    }

    for (let i = 0; i < n; i++) {
      this._adjacencyList[i].sort((a, b) => a - b);
    }
  }

  _addEdge(a, b) {
    if (a < 0 || a >= this.nodeCount || b < 0 || b >= this.nodeCount) return;
    if (a === b) return;

    if (!this._adjacencyMatrix[a][b]) {
      this._adjacencyMatrix[a][b] = true;
      this._adjacencyList[a].push(b);
    }

    if (!this._adjacencyMatrix[b][a]) {
      this._adjacencyMatrix[b][a] = true;
      this._adjacencyList[b].push(a);
    }
  }

  _addJump(from, over, to) {
    if (
      from < 0 || from >= this.nodeCount ||
      over < 0 || over >= this.nodeCount ||
      to < 0 || to >= this.nodeCount
    ) return;
    if (from === to || from === over || over === to) return;

    const key = `${from},${over}`;
    if (!this._jumpLookup.has(key)) {
      this._jumpLookup.set(key, to);
      this._jumpedNodeLookup.set(`${from},${to}`, over);
      const jump = new JumpPath(from, over, to);
      this._jumpsFromNode[from].push(jump);
      this.allJumpPaths.push(jump);
    }
  }

  getNode(nodeId) {
    if (nodeId < 0 || nodeId >= this.nodeCount) {
      throw new Error(`Node ID ${nodeId} is out of bounds (0..${this.nodeCount - 1}).`);
    }
    return this.nodes[nodeId];
  }

  getAdjacentNodes(nodeId) {
    if (nodeId < 0 || nodeId >= this.nodeCount) return [];
    return this._adjacencyList[nodeId];
  }

  areAdjacent(a, b) {
    if (a < 0 || a >= this.nodeCount || b < 0 || b >= this.nodeCount) return false;
    return this._adjacencyMatrix[a][b];
  }

  tryGetJump(from, over) {
    const key = `${from},${over}`;
    return this._jumpLookup.has(key) ? this._jumpLookup.get(key) : null;
  }

  tryGetJumpedNode(from, to) {
    const key = `${from},${to}`;
    return this._jumpedNodeLookup.has(key) ? this._jumpedNodeLookup.get(key) : null;
  }

  getJumpsFrom(fromNode) {
    if (fromNode < 0 || fromNode >= this.nodeCount) return [];
    return this._jumpsFromNode[fromNode];
  }

  /**
   * Creates the standard 23-node Aadu Puli Aatam board graph.
   * @returns {BoardGraph}
   */
  static createStandardAaduPuliAatamGraph() {
    const nodes = [
      // Row 0 - Apex
      new BoardNode(0,  0.0,  4.0, "Apex_0"),

      // Row 1 - 3 nodes
      new BoardNode(1, -1.0,  3.0, "R1_Left_1"),
      new BoardNode(2,  0.0,  3.0, "R1_Center_2"),
      new BoardNode(3,  1.0,  3.0, "R1_Right_3"),

      // Row 2 - 5 nodes
      new BoardNode(4, -2.0,  2.0, "R2_L2_4"),
      new BoardNode(5, -1.0,  2.0, "R2_L1_5"),
      new BoardNode(6,  0.0,  2.0, "R2_Center_6"),
      new BoardNode(7,  1.0,  2.0, "R2_R1_7"),
      new BoardNode(8,  2.0,  2.0, "R2_R2_8"),

      // Row 3 - 7 nodes
      new BoardNode(9,  -3.0, 1.0, "R3_L3_9"),
      new BoardNode(10, -2.0, 1.0, "R3_L2_10"),
      new BoardNode(11, -1.0, 1.0, "R3_L1_11"),
      new BoardNode(12,  0.0, 1.0, "R3_Center_12"),
      new BoardNode(13,  1.0, 1.0, "R3_R1_13"),
      new BoardNode(14,  2.0, 1.0, "R3_R2_14"),
      new BoardNode(15,  3.0, 1.0, "R3_R3_15"),

      // Row 4 - Base 7 nodes
      new BoardNode(16, -3.0, 0.0, "Base_L3_16"),
      new BoardNode(17, -2.0, 0.0, "Base_L2_17"),
      new BoardNode(18, -1.0, 0.0, "Base_L1_18"),
      new BoardNode(19,  0.0, 0.0, "Base_Center_19"),
      new BoardNode(20,  1.0, 0.0, "Base_R1_20"),
      new BoardNode(21,  2.0, 0.0, "Base_R2_21"),
      new BoardNode(22,  3.0, 0.0, "Base_R3_22")
    ];

    const lines = [
      // 1. Horizontal crossbars
      [1, 2, 3],
      [4, 5, 6, 7, 8],
      [9, 10, 11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20, 21, 22],

      // 2. Vertical columns
      [9, 16],
      [4, 10, 17],
      [1, 5, 11, 18],
      [0, 2, 6, 12, 19],
      [3, 7, 13, 20],
      [8, 14, 21],
      [15, 22],

      // 3. Down-Left Diagonals
      [0, 1, 4, 9],
      [2, 5, 10, 16],
      [3, 6, 11, 17],
      [8, 13, 19],
      [7, 12, 18],
      [14, 20],
      [15, 21],

      // 4. Down-Right Diagonals
      [0, 3, 8, 15],
      [2, 7, 14, 22],
      [1, 6, 13, 21],
      [4, 11, 19],
      [5, 12, 20],
      [10, 18],
      [9, 17]
    ];

    return new BoardGraph(nodes, lines);
  }
}
