/**
 * 2D Geometry Engine - Foundation for CAD Tools
 *
 * Core 2D primitives and operations used by:
 * - Schematic editor (symbol placement)
 * - PCB designer (trace routing)
 * - 3D CAD sketcher (2D profiles)
 * - General 2D CAD (drawings)
 */

use std::f64::consts::PI;

// ============ CORE PRIMITIVES ============

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    pub fn distance_to(&self, other: Point) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
    }

    pub fn angle_to(&self, other: Point) -> f64 {
        let dx = other.x - self.x;
        let dy = other.y - self.y;
        dy.atan2(dx)
    }

    pub fn transform(&self, transform: &Transform2D) -> Point {
        // Translate
        let mut x = self.x + transform.tx;
        let mut y = self.y + transform.ty;

        // Rotate
        let cos_r = transform.rotation.cos();
        let sin_r = transform.rotation.sin();
        let rx = x * cos_r - y * sin_r;
        let ry = x * sin_r + y * cos_r;
        x = rx;
        y = ry;

        // Scale
        x *= transform.scale;
        y *= transform.scale;

        Point { x, y }
    }
}

#[derive(Debug, Clone)]
pub enum GeometricEntity {
    Point(Point),
    Line { start: Point, end: Point },
    Arc {
        center: Point,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    },
    Circle { center: Point, radius: f64 },
    Polygon { points: Vec<Point> },
    Text {
        position: Point,
        content: String,
        height: f64,
    },
}

#[derive(Debug, Clone, Copy)]
pub struct BoundingBox {
    pub min: Point,
    pub max: Point,
}

impl BoundingBox {
    pub fn contains_point(&self, point: Point) -> bool {
        point.x >= self.min.x && point.x <= self.max.x && point.y >= self.min.y && point.y <= self.max.y
    }

    pub fn intersects_box(&self, other: &BoundingBox) -> bool {
        !(self.max.x < other.min.x
            || self.min.x > other.max.x
            || self.max.y < other.min.y
            || self.min.y > other.max.y)
    }

    pub fn width(&self) -> f64 {
        self.max.x - self.min.x
    }

    pub fn height(&self) -> f64 {
        self.max.y - self.min.y
    }

    pub fn center(&self) -> Point {
        Point {
            x: (self.min.x + self.max.x) / 2.0,
            y: (self.min.y + self.max.y) / 2.0,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Transform2D {
    pub tx: f64,      // Translation X
    pub ty: f64,      // Translation Y
    pub scale: f64,   // Uniform scale
    pub rotation: f64, // Radians
}

impl Default for Transform2D {
    fn default() -> Self {
        Transform2D {
            tx: 0.0,
            ty: 0.0,
            scale: 1.0,
            rotation: 0.0,
        }
    }
}

impl Transform2D {
    pub fn translate(x: f64, y: f64) -> Self {
        Transform2D {
            tx: x,
            ty: y,
            scale: 1.0,
            rotation: 0.0,
        }
    }

    pub fn rotate(angle: f64) -> Self {
        Transform2D {
            tx: 0.0,
            ty: 0.0,
            scale: 1.0,
            rotation: angle,
        }
    }

    pub fn scale(factor: f64) -> Self {
        Transform2D {
            tx: 0.0,
            ty: 0.0,
            scale: factor,
            rotation: 0.0,
        }
    }

    pub fn combine(&self, other: &Transform2D) -> Self {
        // Apply self first, then other
        let scale = self.scale * other.scale;
        let rotation = self.rotation + other.rotation;
        let tx = self.tx + other.tx;
        let ty = self.ty + other.ty;

        Transform2D {
            tx,
            ty,
            scale,
            rotation,
        }
    }
}

impl GeometricEntity {
    pub fn bounding_box(&self) -> BoundingBox {
        match self {
            GeometricEntity::Point(p) => BoundingBox {
                min: *p,
                max: *p,
            },
            GeometricEntity::Line { start, end } => {
                let min_x = start.x.min(end.x);
                let max_x = start.x.max(end.x);
                let min_y = start.y.min(end.y);
                let max_y = start.y.max(end.y);
                BoundingBox {
                    min: Point { x: min_x, y: min_y },
                    max: Point { x: max_x, y: max_y },
                }
            }
            GeometricEntity::Circle { center, radius } => {
                let r = radius.abs();
                BoundingBox {
                    min: Point {
                        x: center.x - r,
                        y: center.y - r,
                    },
                    max: Point {
                        x: center.x + r,
                        y: center.y + r,
                    },
                }
            }
            GeometricEntity::Arc {
                center,
                radius,
                start_angle,
                end_angle,
            } => {
                let r = radius.abs();
                let mut min_x = center.x - r;
                let mut max_x = center.x + r;
                let mut min_y = center.y - r;
                let mut max_y = center.y + r;

                // Check start and end points
                let start_point = Point {
                    x: center.x + r * start_angle.cos(),
                    y: center.y + r * start_angle.sin(),
                };
                let end_point = Point {
                    x: center.x + r * end_angle.cos(),
                    y: center.y + r * end_angle.sin(),
                };

                min_x = min_x.min(start_point.x).min(end_point.x);
                max_x = max_x.max(start_point.x).max(end_point.x);
                min_y = min_y.min(start_point.y).min(end_point.y);
                max_y = max_y.max(start_point.y).max(end_point.y);

                BoundingBox {
                    min: Point { x: min_x, y: min_y },
                    max: Point { x: max_x, y: max_y },
                }
            }
            GeometricEntity::Polygon { points } => {
                if points.is_empty() {
                    return BoundingBox {
                        min: Point { x: 0.0, y: 0.0 },
                        max: Point { x: 0.0, y: 0.0 },
                    };
                }

                let min_x = points.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
                let max_x = points.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
                let min_y = points.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
                let max_y = points.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);

                BoundingBox {
                    min: Point { x: min_x, y: min_y },
                    max: Point { x: max_x, y: max_y },
                }
            }
            GeometricEntity::Text {
                position,
                height,
                content,
            } => {
                let width = content.len() as f64 * height * 0.6;
                BoundingBox {
                    min: *position,
                    max: Point {
                        x: position.x + width,
                        y: position.y + height,
                    },
                }
            }
        }
    }

    pub fn contains_point(&self, point: Point, tolerance: f64) -> bool {
        match self {
            GeometricEntity::Point(p) => p.distance_to(point) <= tolerance,
            GeometricEntity::Line { start, end } => {
                let dist_to_line = line_point_distance(*start, *end, point);
                dist_to_line <= tolerance
            }
            GeometricEntity::Circle { center, radius } => {
                let dist = center.distance_to(point);
                (dist - radius).abs() <= tolerance
            }
            GeometricEntity::Arc {
                center,
                radius,
                start_angle,
                end_angle,
            } => {
                let dist = center.distance_to(point);
                if (dist - radius).abs() > tolerance {
                    return false;
                }

                let angle = center.angle_to(point);
                angle_in_range(angle, *start_angle, *end_angle)
            }
            GeometricEntity::Polygon { points } => {
                if points.is_empty() {
                    return false;
                }

                // Check if point is close to any edge
                for i in 0..points.len() {
                    let p1 = points[i];
                    let p2 = points[(i + 1) % points.len()];
                    let dist = line_point_distance(p1, p2, point);
                    if dist <= tolerance {
                        return true;
                    }
                }

                // Check if point is inside polygon
                point_in_polygon(point, points)
            }
            GeometricEntity::Text { .. } => {
                let bbox = self.bounding_box();
                bbox.contains_point(point)
            }
        }
    }

    pub fn intersects(&self, other: &GeometricEntity, tolerance: f64) -> Vec<Point> {
        match (self, other) {
            (GeometricEntity::Line { start: s1, end: e1 }, GeometricEntity::Line { start: s2, end: e2 }) => {
                line_line_intersection(*s1, *e1, *s2, *e2, tolerance)
            }
            (GeometricEntity::Line { start: s, end: e }, GeometricEntity::Circle { center, radius })
            | (GeometricEntity::Circle { center, radius }, GeometricEntity::Line { start: s, end: e }) => {
                line_circle_intersection(*s, *e, *center, *radius, tolerance)
            }
            (GeometricEntity::Circle { center: c1, radius: r1 }, GeometricEntity::Circle { center: c2, radius: r2 }) => {
                circle_circle_intersection(*c1, *r1, *c2, *r2, tolerance)
            }
            _ => Vec::new(),
        }
    }

    pub fn transform(&mut self, transform: &Transform2D) {
        match self {
            GeometricEntity::Point(p) => {
                *p = p.transform(transform);
            }
            GeometricEntity::Line { start, end } => {
                *start = start.transform(transform);
                *end = end.transform(transform);
            }
            GeometricEntity::Arc {
                center,
                radius,
                start_angle,
                end_angle,
            } => {
                *center = center.transform(transform);
                *radius *= transform.scale;
                *start_angle += transform.rotation;
                *end_angle += transform.rotation;
            }
            GeometricEntity::Circle { center, radius } => {
                *center = center.transform(transform);
                *radius *= transform.scale;
            }
            GeometricEntity::Polygon { points } => {
                for p in points.iter_mut() {
                    *p = p.transform(transform);
                }
            }
            GeometricEntity::Text {
                position,
                height,
                ..
            } => {
                *position = position.transform(transform);
                *height *= transform.scale;
            }
        }
    }
}

// ============ GEOMETRIC OPERATIONS ============

pub fn line_point_distance(start: Point, end: Point, point: Point) -> f64 {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let len_sq = dx * dx + dy * dy;

    if len_sq == 0.0 {
        return start.distance_to(point);
    }

    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / len_sq;
    let t = t.clamp(0.0, 1.0);

    let closest = Point {
        x: start.x + t * dx,
        y: start.y + t * dy,
    };

    point.distance_to(closest)
}

pub fn line_line_intersection(s1: Point, e1: Point, s2: Point, e2: Point, tolerance: f64) -> Vec<Point> {
    let x1 = s1.x;
    let y1 = s1.y;
    let x2 = e1.x;
    let y2 = e1.y;
    let x3 = s2.x;
    let y3 = s2.y;
    let x4 = e2.x;
    let y4 = e2.y;

    let denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if denom.abs() < tolerance {
        return Vec::new(); // Parallel lines
    }

    let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    let u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if t >= 0.0 && t <= 1.0 && u >= 0.0 && u <= 1.0 {
        let ix = x1 + t * (x2 - x1);
        let iy = y1 + t * (y2 - y1);
        vec![Point { x: ix, y: iy }]
    } else {
        Vec::new()
    }
}

pub fn line_circle_intersection(s: Point, e: Point, center: Point, radius: f64, _tolerance: f64) -> Vec<Point> {
    let dx = e.x - s.x;
    let dy = e.y - s.y;
    let fx = s.x - center.x;
    let fy = s.y - center.y;

    let a = dx * dx + dy * dy;
    let b = 2.0 * (fx * dx + fy * dy);
    let c = fx * fx + fy * fy - radius * radius;

    let discriminant = b * b - 4.0 * a * c;

    if discriminant < 0.0 {
        return Vec::new();
    }

    let sqrt_disc = discriminant.sqrt();
    let t1 = (-b - sqrt_disc) / (2.0 * a);
    let t2 = (-b + sqrt_disc) / (2.0 * a);

    let mut intersections = Vec::new();

    for t in &[t1, t2] {
        if *t >= 0.0 && *t <= 1.0 {
            let ix = s.x + t * dx;
            let iy = s.y + t * dy;
            intersections.push(Point { x: ix, y: iy });
        }
    }

    intersections
}

pub fn circle_circle_intersection(c1: Point, r1: f64, c2: Point, r2: f64, tolerance: f64) -> Vec<Point> {
    let d = c1.distance_to(c2);

    if d > r1 + r2 + tolerance || d < (r1 - r2).abs() - tolerance || d < tolerance {
        return Vec::new(); // No intersection
    }

    let a = (r1 * r1 - r2 * r2 + d * d) / (2.0 * d);
    let h = (r1 * r1 - a * a).sqrt();

    let px = c1.x + a * (c2.x - c1.x) / d;
    let py = c1.y + a * (c2.y - c1.y) / d;

    let ix1 = px + h * (c2.y - c1.y) / d;
    let iy1 = py - h * (c2.x - c1.x) / d;

    let ix2 = px - h * (c2.y - c1.y) / d;
    let iy2 = py + h * (c2.x - c1.x) / d;

    vec![Point { x: ix1, y: iy1 }, Point { x: ix2, y: iy2 }]
}

fn angle_in_range(angle: f64, start: f64, end: f64) -> bool {
    let mut angle = angle % (2.0 * PI);
    let mut start = start % (2.0 * PI);
    let mut end = end % (2.0 * PI);

    if angle < 0.0 {
        angle += 2.0 * PI;
    }
    if start < 0.0 {
        start += 2.0 * PI;
    }
    if end < 0.0 {
        end += 2.0 * PI;
    }

    if start <= end {
        angle >= start && angle <= end
    } else {
        angle >= start || angle <= end
    }
}

fn point_in_polygon(point: Point, polygon: &[Point]) -> bool {
    let mut inside = false;

    for i in 0..polygon.len() {
        let p1 = polygon[i];
        let p2 = polygon[(i + 1) % polygon.len()];

        if (p1.y > point.y) != (p2.y > point.y)
            && point.x < (p2.x - p1.x) * (point.y - p1.y) / (p2.y - p1.y) + p1.x
        {
            inside = !inside;
        }
    }

    inside
}

// ============ CONSTRAINT SOLVER ============

pub struct ConstraintSolver {
    pub grid_size: f64,
    pub snap_distance: f64,
}

impl Default for ConstraintSolver {
    fn default() -> Self {
        ConstraintSolver {
            grid_size: 1.0,
            snap_distance: 5.0,
        }
    }
}

impl ConstraintSolver {
    pub fn new(grid_size: f64, snap_distance: f64) -> Self {
        ConstraintSolver {
            grid_size,
            snap_distance,
        }
    }

    pub fn snap_to_grid(&self, point: Point) -> Point {
        let x = (point.x / self.grid_size).round() * self.grid_size;
        let y = (point.y / self.grid_size).round() * self.grid_size;
        Point { x, y }
    }

    pub fn find_snap_candidates(&self, point: Point, entities: &[GeometricEntity]) -> Vec<Point> {
        let mut candidates = Vec::new();

        // Add grid snap points
        candidates.push(self.snap_to_grid(point));

        // Find nearby entity snap points (endpoints, centers, intersections)
        for entity in entities {
            match entity {
                GeometricEntity::Line { start, end } => {
                    if point.distance_to(*start) <= self.snap_distance {
                        candidates.push(*start);
                    }
                    if point.distance_to(*end) <= self.snap_distance {
                        candidates.push(*end);
                    }
                    // Midpoint
                    let mid = Point {
                        x: (start.x + end.x) / 2.0,
                        y: (start.y + end.y) / 2.0,
                    };
                    if point.distance_to(mid) <= self.snap_distance {
                        candidates.push(mid);
                    }
                }
                GeometricEntity::Circle { center, .. } => {
                    if point.distance_to(*center) <= self.snap_distance {
                        candidates.push(*center);
                    }
                }
                GeometricEntity::Arc { center, .. } => {
                    if point.distance_to(*center) <= self.snap_distance {
                        candidates.push(*center);
                    }
                }
                _ => {}
            }
        }

        // Remove duplicates (within tolerance)
        candidates.sort_by(|a, b| {
            let dist_a = point.distance_to(*a);
            let dist_b = point.distance_to(*b);
            dist_a.partial_cmp(&dist_b).unwrap_or(std::cmp::Ordering::Equal)
        });

        candidates.dedup_by(|a, b| a.distance_to(*b) < 0.01);

        candidates
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let p1 = Point { x: 0.0, y: 0.0 };
        let p2 = Point { x: 3.0, y: 4.0 };
        let distance = p1.distance_to(p2);
        assert!((distance - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_line_intersection() {
        let int = line_line_intersection(
            Point { x: 0.0, y: 0.0 },
            Point { x: 10.0, y: 0.0 },
            Point { x: 5.0, y: -5.0 },
            Point { x: 5.0, y: 5.0 },
            0.001,
        );
        assert_eq!(int.len(), 1);
        assert!((int[0].x - 5.0).abs() < 1e-6);
        assert!((int[0].y - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_snap_to_grid() {
        let solver = ConstraintSolver::new(1.0, 5.0);
        let point = Point { x: 3.47, y: 7.52 };
        let snapped = solver.snap_to_grid(point);
        assert_eq!(snapped.x, 3.0);
        assert_eq!(snapped.y, 8.0);
    }

    #[test]
    fn test_bounding_box() {
        let entity = GeometricEntity::Polygon {
            points: vec![
                Point { x: 0.0, y: 0.0 },
                Point { x: 10.0, y: 5.0 },
                Point { x: 5.0, y: 10.0 },
            ],
        };
        let bbox = entity.bounding_box();
        assert_eq!(bbox.min.x, 0.0);
        assert_eq!(bbox.max.x, 10.0);
        assert_eq!(bbox.min.y, 0.0);
        assert_eq!(bbox.max.y, 10.0);
    }

    #[test]
    fn test_circle_intersection() {
        let int = circle_circle_intersection(
            Point { x: 0.0, y: 0.0 },
            5.0,
            Point { x: 10.0, y: 0.0 },
            5.0,
            0.001,
        );
        assert_eq!(int.len(), 2);
    }

    #[test]
    fn test_transform() {
        let mut entity = GeometricEntity::Point(Point { x: 0.0, y: 0.0 });
        let transform = Transform2D {
            tx: 5.0,
            ty: 3.0,
            scale: 1.0,
            rotation: 0.0,
        };
        entity.transform(&transform);
        if let GeometricEntity::Point(p) = entity {
            assert!((p.x - 5.0).abs() < 1e-6);
            assert!((p.y - 3.0).abs() < 1e-6);
        } else {
            panic!("Expected point");
        }
    }

    #[test]
    fn test_line_point_distance() {
        let dist = line_point_distance(
            Point { x: 0.0, y: 0.0 },
            Point { x: 10.0, y: 0.0 },
            Point { x: 5.0, y: 5.0 },
        );
        assert!((dist - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_snap_candidates() {
        let solver = ConstraintSolver::new(1.0, 10.0);
        let entities = vec![GeometricEntity::Line {
            start: Point { x: 0.0, y: 0.0 },
            end: Point { x: 10.0, y: 0.0 },
        }];

        let candidates = solver.find_snap_candidates(Point { x: 5.1, y: 0.1 }, &entities);
        assert!(candidates.len() > 0);
    }
}
