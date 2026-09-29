import { MoveType } from './enums.js';

/**
 * Represents a single game action in Aadu Puli Aatam.
 */
export class Move {
  /**
   * @param {number} type MoveType
   * @param {number} fromNode
   * @param {number} toNode
   * @param {number} capturedGoatNode
   */
  constructor(type, fromNode = -1, toNode = -1, capturedGoatNode = -1) {
    this.type = type;
    this.fromNode = fromNode;
    this.toNode = toNode;
    this.capturedGoatNode = capturedGoatNode;
  }

  get isPlacement() {
    return this.type === MoveType.PlaceGoat;
  }

  get isCapture() {
    return this.type === MoveType.TigerCapture;
  }

  get isStep() {
    return this.type === MoveType.MoveTiger || this.type === MoveType.MoveGoat;
  }

  static place(toNode) {
    return new Move(MoveType.PlaceGoat, -1, toNode, -1);
  }

  static tigerMove(fromNode, toNode) {
    return new Move(MoveType.MoveTiger, fromNode, toNode, -1);
  }

  static goatMove(fromNode, toNode) {
    return new Move(MoveType.MoveGoat, fromNode, toNode, -1);
  }

  static tigerCapture(fromNode, overNode, toNode) {
    return new Move(MoveType.TigerCapture, fromNode, toNode, overNode);
  }

  equals(other) {
    if (!other) return false;
    return (
      this.type === other.type &&
      this.fromNode === other.fromNode &&
      this.toNode === other.toNode &&
      this.capturedGoatNode === other.capturedGoatNode
    );
  }

  toString() {
    switch (this.type) {
      case MoveType.PlaceGoat:
        return `PlaceGoat -> Node ${this.toNode}`;
      case MoveType.MoveTiger:
        return `MoveTiger: ${this.fromNode} -> ${this.toNode}`;
      case MoveType.MoveGoat:
        return `MoveGoat: ${this.fromNode} -> ${this.toNode}`;
      case MoveType.TigerCapture:
        return `TigerCapture: ${this.fromNode} -> (x${this.capturedGoatNode}) -> ${this.toNode}`;
      default:
        return 'UnknownMove';
    }
  }
}
