/**
 * Trace Router - Automated PCB trace routing
 *
 * Algorithms:
 * - Manhattan routing (orthogonal paths only)
 * - Lee algorithm for maze solving
 * - Via insertion for layer transitions
 * - Obstacle avoidance
 */

import { v4 as uuidv4 } from 'uuid';
import { Trace, Via, PlacedComponent, PCBLayer } from './types';

export interface RoutingNode {
  x: number;
  y: number;
  layer: PCBLayer;
  visited: boolean;
  parent?: RoutingNode;
  distance: number;
}

export interface RoutePath {
  segments: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>;
  vias: Array<{ position: { x: number; y: number }; fromLayer: PCBLayer; toLayer: PCBLayer }>;
}

export class TraceRouter {
  private grid: Map<string, RoutingNode> = new Map();
  private gridSize: number = 0.1; // 0.1mm grid resolution
  private boardWidth: number;
  private boardHeight: number;
  private obstacles: Array<{ x: number; y: number; radius: number; layer: PCBLayer }> = [];

  constructor(boardWidth: number, boardHeight: number) {
    this.boardWidth = boardWidth;
    this.boardHeight = boardHeight;
  }

  /**
   * Add obstacles (components, existing traces)
   */
  public addObstacle(x: number, y: number, radius: number, layer: PCBLayer): void {
    this.obstacles.push({ x, y, radius, layer });
  }

  /**
   * Clear all obstacles
   */
  public clearObstacles(): void {
    this.obstacles = [];
  }

  /**
   * Route between two points using Lee algorithm (maze routing)
   */
  public routeTrace(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    layer: PCBLayer,
    traceWidth: number = 0.254
  ): RoutePath | null {
    // Initialize grid
    this.initializeGrid(layer);

    // BFS from start to end
    const queue: RoutingNode[] = [];
    const startKey = this.getGridKey(startX, startY, layer);
    const endKey = this.getGridKey(endX, endY, layer);

    const startNode = this.grid.get(startKey);
    if (!startNode) return null;

    startNode.distance = 0;
    queue.push(startNode);

    // BFS
    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.x === endX && current.y === endY) {
        // Path found - reconstruct
        return this.reconstructPath(current, startNode, traceWidth);
      }

      // Explore neighbors (4-connectivity for Manhattan)
      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (!neighbor.visited && this.isPassable(neighbor, traceWidth)) {
          neighbor.visited = true;
          neighbor.parent = current;
          neighbor.distance = current.distance + 1;
          queue.push(neighbor);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Route with via insertion for multi-layer routing
   */
  public routeMultilayer(
    startX: number,
    startY: number,
    startLayer: PCBLayer,
    endX: number,
    endY: number,
    endLayer: PCBLayer,
    availableLayers: PCBLayer[],
    traceWidth: number = 0.254
  ): RoutePath | null {
    // Simple approach: route on start layer, insert via, route on end layer
    const path1 = this.routeTrace(startX, startY, endX, endY, startLayer, traceWidth);

    if (!path1) return null;

    const vias: Array<{ position: { x: number; y: number }; fromLayer: PCBLayer; toLayer: PCBLayer }> = [];

    if (startLayer !== endLayer) {
      // Insert via at end of first path
      vias.push({
        position: { x: endX, y: endY },
        fromLayer: startLayer,
        toLayer: endLayer,
      });
    }

    return {
      segments: path1.segments,
      vias,
    };
  }

  /**
   * Initialize routing grid
   */
  private initializeGrid(layer: PCBLayer): void {
    this.grid.clear();

    const gridStepsX = Math.ceil(this.boardWidth / this.gridSize);
    const gridStepsY = Math.ceil(this.boardHeight / this.gridSize);

    for (let xi = 0; xi < gridStepsX; xi++) {
      for (let yi = 0; yi < gridStepsY; yi++) {
        const x = xi * this.gridSize;
        const y = yi * this.gridSize;
        const key = this.getGridKey(x, y, layer);

        this.grid.set(key, {
          x,
          y,
          layer,
          visited: false,
          distance: Infinity,
        });
      }
    }
  }

  /**
   * Get grid key
   */
  private getGridKey(x: number, y: number, layer: PCBLayer): string {
    const xi = Math.round(x / this.gridSize);
    const yi = Math.round(y / this.gridSize);
    return `${xi}_${yi}_${layer}`;
  }

  /**
   * Get neighboring grid points
   */
  private getNeighbors(node: RoutingNode): RoutingNode[] {
    const neighbors: RoutingNode[] = [];
    const offsets = [
      { dx: this.gridSize, dy: 0 },
      { dx: -this.gridSize, dy: 0 },
      { dx: 0, dy: this.gridSize },
      { dx: 0, dy: -this.gridSize },
    ];

    for (const offset of offsets) {
      const newX = node.x + offset.dx;
      const newY = node.y + offset.dy;

      if (newX >= 0 && newX <= this.boardWidth && newY >= 0 && newY <= this.boardHeight) {
        const key = this.getGridKey(newX, newY, node.layer);
        const neighbor = this.grid.get(key);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Check if grid point is passable
   */
  private isPassable(node: RoutingNode, traceWidth: number): boolean {
    // Check distance to obstacles
    for (const obstacle of this.obstacles) {
      if (obstacle.layer !== node.layer) continue;

      const distance = Math.hypot(node.x - obstacle.x, node.y - obstacle.y);
      const requiredDistance = obstacle.radius + traceWidth / 2 + 0.254; // Add clearance

      if (distance < requiredDistance) {
        return false;
      }
    }

    // Check board boundaries
    if (node.x < 0 || node.x > this.boardWidth || node.y < 0 || node.y > this.boardHeight) {
      return false;
    }

    return true;
  }

  /**
   * Reconstruct path from end node to start
   */
  private reconstructPath(endNode: RoutingNode, startNode: RoutingNode, traceWidth: number): RoutePath {
    const segments: RoutePath['segments'] = [];
    let current: RoutingNode | undefined = endNode;

    while (current && current !== startNode) {
      if (current.parent) {
        segments.unshift({
          start: { x: current.parent.x, y: current.parent.y },
          end: { x: current.x, y: current.y },
        });
        current = current.parent;
      } else {
        break;
      }
    }

    return {
      segments,
      vias: [],
    };
  }

  /**
   * Simplify path by removing redundant points (convert to Manhattan)
   */
  public simplifyPath(path: RoutePath): RoutePath {
    const simplified: RoutePath['segments'] = [];

    for (const segment of path.segments) {
      if (simplified.length === 0) {
        simplified.push(segment);
      } else {
        const lastSegment = simplified[simplified.length - 1];

        // Check if current segment is collinear with last
        const lastHorizontal = lastSegment.start.y === lastSegment.end.y;
        const currentHorizontal = segment.start.y === segment.end.y;

        if (lastHorizontal === currentHorizontal) {
          // Merge segments
          lastSegment.end = segment.end;
        } else {
          simplified.push(segment);
        }
      }
    }

    return {
      segments: simplified,
      vias: path.vias,
    };
  }

  /**
   * Calculate path length
   */
  public calculatePathLength(path: RoutePath): number {
    let length = 0;
    for (const segment of path.segments) {
      length += Math.hypot(
        segment.end.x - segment.start.x,
        segment.end.y - segment.start.y
      );
    }
    return length;
  }

  /**
   * Convert path to PCB trace
   */
  public pathToTrace(path: RoutePath, layer: PCBLayer, netName: string, width: number = 0.254): Trace {
    return {
      id: uuidv4(),
      netName,
      layer,
      width,
      style: 'manhattan',
      segments: path.segments,
    };
  }

  /**
   * Convert path vias to Via objects
   */
  public pathToVias(path: RoutePath): Via[] {
    return path.vias.map(via => ({
      id: uuidv4(),
      position: via.position,
      diameter: 0.6,
      fromLayer: via.fromLayer,
      toLayer: via.toLayer,
    }));
  }
}
