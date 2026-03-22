//! Spatialization: Geometric Queries and Spatial Indexing
//! Phase 25 Task 3 - Clifford Algebra Applications

use std::f64::consts::PI;

/// 3D Point
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2) + (self.z - other.z).powi(2)).sqrt()
    }

    pub fn distance_squared_to(&self, other: &Point3D) -> f64 {
        (self.x - other.x).powi(2) + (self.y - other.y).powi(2) + (self.z - other.z).powi(2)
    }

    pub fn origin() -> Self {
        Point3D { x: 0.0, y: 0.0, z: 0.0 }
    }
}

/// 3D Sphere
#[derive(Debug, Clone, Copy)]
pub struct Sphere {
    pub center: Point3D,
    pub radius: f64,
}

impl Sphere {
    pub fn new(center: Point3D, radius: f64) -> Self {
        Sphere { center, radius }
    }

    pub fn contains_point(&self, point: &Point3D) -> bool {
        self.center.distance_to(point) <= self.radius + 1e-10
    }

    pub fn distance_to_point(&self, point: &Point3D) -> f64 {
        (self.center.distance_to(point) - self.radius).max(0.0)
    }

    pub fn intersects_sphere(&self, other: &Sphere) -> bool {
        let center_distance = self.center.distance_to(&other.center);
        center_distance <= (self.radius + other.radius) + 1e-10
    }

    pub fn volume(&self) -> f64 {
        (4.0 / 3.0) * PI * self.radius.powi(3)
    }

    pub fn surface_area(&self) -> f64 {
        4.0 * PI * self.radius.powi(2)
    }
}

/// Axis-aligned bounding box (AABB)
#[derive(Debug, Clone, Copy)]
pub struct BoundingBox {
    pub min: Point3D,
    pub max: Point3D,
}

impl BoundingBox {
    pub fn new(min: Point3D, max: Point3D) -> Self {
        BoundingBox { min, max }
    }

    pub fn contains_point(&self, point: &Point3D) -> bool {
        point.x >= self.min.x && point.x <= self.max.x
            && point.y >= self.min.y && point.y <= self.max.y
            && point.z >= self.min.z && point.z <= self.max.z
    }

    pub fn intersects_bbox(&self, other: &BoundingBox) -> bool {
        !(self.max.x < other.min.x || self.min.x > other.max.x
            || self.max.y < other.min.y || self.min.y > other.max.y
            || self.max.z < other.min.z || self.min.z > other.max.z)
    }

    pub fn intersects_sphere(&self, sphere: &Sphere) -> bool {
        let closest_x = sphere.center.x.max(self.min.x).min(self.max.x);
        let closest_y = sphere.center.y.max(self.min.y).min(self.max.y);
        let closest_z = sphere.center.z.max(self.min.z).min(self.max.z);

        let closest = Point3D::new(closest_x, closest_y, closest_z);
        sphere.center.distance_to(&closest) <= sphere.radius + 1e-10
    }

    pub fn volume(&self) -> f64 {
        (self.max.x - self.min.x) * (self.max.y - self.min.y) * (self.max.z - self.min.z)
    }

    pub fn center(&self) -> Point3D {
        Point3D::new(
            (self.min.x + self.max.x) / 2.0,
            (self.min.y + self.max.y) / 2.0,
            (self.min.z + self.max.z) / 2.0,
        )
    }
}

/// Octree node for spatial indexing
#[derive(Debug, Clone)]
pub struct OctreeNode {
    pub bbox: BoundingBox,
    pub points: Vec<Point3D>,
    pub children: Vec<Option<Box<OctreeNode>>>,
    pub is_leaf: bool,
    pub max_points: usize,
}

impl OctreeNode {
    pub fn new(bbox: BoundingBox, max_points: usize) -> Self {
        OctreeNode {
            bbox,
            points: vec![],
            children: vec![],
            is_leaf: true,
            max_points,
        }
    }

    /// Insert point into octree
    pub fn insert(&mut self, point: Point3D, max_depth: usize, current_depth: usize) {
        if !self.bbox.contains_point(&point) {
            return;
        }

        if self.is_leaf {
            self.points.push(point);

            if self.points.len() > self.max_points && current_depth < max_depth {
                self.subdivide();
            }
        } else if !self.children.is_empty() {
            for child in self.children.iter_mut() {
                if let Some(ref mut child_node) = child {
                    child_node.insert(point, max_depth, current_depth + 1);
                }
            }
        }
    }

    /// Subdivide node into 8 children
    fn subdivide(&mut self) {
        let center = self.bbox.center();
        let (x0, x1) = (self.bbox.min.x, center.x);
        let (x2, x3) = (center.x, self.bbox.max.x);
        let (y0, y1) = (self.bbox.min.y, center.y);
        let (y2, y3) = (center.y, self.bbox.max.y);
        let (z0, z1) = (self.bbox.min.z, center.z);
        let (z2, z3) = (center.z, self.bbox.max.z);

        let mut new_children = vec![];
        for i in 0..8 {
            let x_min = if i & 1 == 0 { x0 } else { x2 };
            let x_max = if i & 1 == 0 { x1 } else { x3 };
            let y_min = if i & 2 == 0 { y0 } else { y2 };
            let y_max = if i & 2 == 0 { y1 } else { y3 };
            let z_min = if i & 4 == 0 { z0 } else { z2 };
            let z_max = if i & 4 == 0 { z1 } else { z3 };

            let bbox = BoundingBox::new(Point3D::new(x_min, y_min, z_min), Point3D::new(x_max, y_max, z_max));
            new_children.push(Some(Box::new(OctreeNode::new(bbox, self.max_points))));
        }

        self.children = new_children;
        let mut points_to_insert = vec![];
        points_to_insert.append(&mut self.points);

        self.is_leaf = false;

        for point in points_to_insert {
            for child in self.children.iter_mut() {
                if let Some(ref mut child_node) = child {
                    if child_node.bbox.contains_point(&point) {
                        child_node.insert(point, 10, 1);
                        break;
                    }
                }
            }
        }
    }

    /// Find all points within sphere
    pub fn find_points_in_sphere(&self, sphere: &Sphere) -> Vec<Point3D> {
        let mut result = vec![];

        if !self.bbox.intersects_sphere(sphere) {
            return result;
        }

        for point in &self.points {
            if sphere.contains_point(point) {
                result.push(*point);
            }
        }

        if !self.is_leaf {
            for child in &self.children {
                if let Some(ref child_node) = child {
                    result.extend(child_node.find_points_in_sphere(sphere));
                }
            }
        }

        result
    }

    /// Find k nearest neighbors
    pub fn find_nearest_k(&self, query_point: &Point3D, k: usize, result: &mut Vec<(f64, Point3D)>) {
        for point in &self.points {
            let distance = query_point.distance_to(point);
            result.push((distance, *point));
            if result.len() > k {
                result.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
                result.truncate(k);
            }
        }

        if !self.is_leaf {
            for child in &self.children {
                if let Some(ref child_node) = child {
                    child_node.find_nearest_k(query_point, k, result);
                }
            }
        }
    }
}

/// Geometric query engine
pub struct GeometricQueryEngine {
    octree_root: Option<Box<OctreeNode>>,
}

impl GeometricQueryEngine {
    pub fn new(bounds: BoundingBox, max_points_per_node: usize) -> Self {
        GeometricQueryEngine {
            octree_root: Some(Box::new(OctreeNode::new(bounds, max_points_per_node))),
        }
    }

    /// Add point to spatial index
    pub fn add_point(&mut self, point: Point3D) {
        if let Some(ref mut root) = self.octree_root {
            root.insert(point, 10, 0);
        }
    }

    /// Query: points within sphere
    pub fn query_sphere(&self, sphere: &Sphere) -> Vec<Point3D> {
        if let Some(ref root) = self.octree_root {
            root.find_points_in_sphere(sphere)
        } else {
            vec![]
        }
    }

    /// Query: k nearest neighbors
    pub fn query_nearest_k(&self, query_point: &Point3D, k: usize) -> Vec<Point3D> {
        let mut results = vec![];
        if let Some(ref root) = self.octree_root {
            root.find_nearest_k(query_point, k, &mut results);
        }
        results.sort_by(|a, b| {
            a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal)
        });
        results.into_iter().take(k).map(|(_, p)| p).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point3d_creation() {
        let p = Point3D::new(1.0, 2.0, 3.0);
        assert!((p.x - 1.0).abs() < 1e-10);
        assert!((p.y - 2.0).abs() < 1e-10);
        assert!((p.z - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_point3d_distance() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(3.0, 4.0, 0.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_sphere_contains_point() {
        let sphere = Sphere::new(Point3D::new(0.0, 0.0, 0.0), 1.0);
        let inside = Point3D::new(0.5, 0.0, 0.0);
        let outside = Point3D::new(2.0, 0.0, 0.0);

        assert!(sphere.contains_point(&inside));
        assert!(!sphere.contains_point(&outside));
    }

    #[test]
    fn test_sphere_volume() {
        let sphere = Sphere::new(Point3D::new(0.0, 0.0, 0.0), 1.0);
        let volume = sphere.volume();
        assert!((volume - (4.0 / 3.0) * PI).abs() < 0.01);
    }

    #[test]
    fn test_sphere_surface_area() {
        let sphere = Sphere::new(Point3D::new(0.0, 0.0, 0.0), 1.0);
        let area = sphere.surface_area();
        assert!((area - 4.0 * PI).abs() < 0.01);
    }

    #[test]
    fn test_sphere_intersection() {
        let s1 = Sphere::new(Point3D::new(0.0, 0.0, 0.0), 1.0);
        let s2 = Sphere::new(Point3D::new(1.5, 0.0, 0.0), 1.0);
        let s3 = Sphere::new(Point3D::new(5.0, 0.0, 0.0), 1.0);

        assert!(s1.intersects_sphere(&s2));
        assert!(!s1.intersects_sphere(&s3));
    }

    #[test]
    fn test_bbox_contains_point() {
        let bbox = BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(1.0, 1.0, 1.0));
        assert!(bbox.contains_point(&Point3D::new(0.5, 0.5, 0.5)));
        assert!(!bbox.contains_point(&Point3D::new(2.0, 2.0, 2.0)));
    }

    #[test]
    fn test_bbox_intersection() {
        let b1 = BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(1.0, 1.0, 1.0));
        let b2 = BoundingBox::new(Point3D::new(0.5, 0.5, 0.5), Point3D::new(1.5, 1.5, 1.5));
        let b3 = BoundingBox::new(Point3D::new(2.0, 2.0, 2.0), Point3D::new(3.0, 3.0, 3.0));

        assert!(b1.intersects_bbox(&b2));
        assert!(!b1.intersects_bbox(&b3));
    }

    #[test]
    fn test_bbox_sphere_intersection() {
        let bbox = BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(1.0, 1.0, 1.0));
        let s1 = Sphere::new(Point3D::new(0.5, 0.5, 0.5), 0.5);
        let s2 = Sphere::new(Point3D::new(5.0, 5.0, 5.0), 1.0);

        assert!(bbox.intersects_sphere(&s1));
        assert!(!bbox.intersects_sphere(&s2));
    }

    #[test]
    fn test_octree_insertion() {
        let bbox = BoundingBox::new(Point3D::new(-10.0, -10.0, -10.0), Point3D::new(10.0, 10.0, 10.0));
        let mut node = OctreeNode::new(bbox, 2);

        node.insert(Point3D::new(0.0, 0.0, 0.0), 5, 0);
        node.insert(Point3D::new(1.0, 1.0, 1.0), 5, 0);

        assert_eq!(node.points.len(), 2);
    }

    #[test]
    fn test_query_engine_creation() {
        let bbox = BoundingBox::new(Point3D::new(-10.0, -10.0, -10.0), Point3D::new(10.0, 10.0, 10.0));
        let engine = GeometricQueryEngine::new(bbox, 4);
        assert!(engine.octree_root.is_some());
    }

    #[test]
    fn test_query_engine_add_and_sphere_query() {
        let bbox = BoundingBox::new(Point3D::new(-10.0, -10.0, -10.0), Point3D::new(10.0, 10.0, 10.0));
        let mut engine = GeometricQueryEngine::new(bbox, 4);

        engine.add_point(Point3D::new(0.0, 0.0, 0.0));
        engine.add_point(Point3D::new(1.0, 0.0, 0.0));
        engine.add_point(Point3D::new(10.0, 10.0, 10.0));

        let sphere = Sphere::new(Point3D::new(0.0, 0.0, 0.0), 2.0);
        let results = engine.query_sphere(&sphere);

        assert!(results.len() >= 2);
    }

    #[test]
    fn test_query_engine_nearest_k() {
        let bbox = BoundingBox::new(Point3D::new(-10.0, -10.0, -10.0), Point3D::new(10.0, 10.0, 10.0));
        let mut engine = GeometricQueryEngine::new(bbox, 4);

        engine.add_point(Point3D::new(0.0, 0.0, 0.0));
        engine.add_point(Point3D::new(1.0, 0.0, 0.0));
        engine.add_point(Point3D::new(2.0, 0.0, 0.0));

        let query = Point3D::new(0.0, 0.0, 0.0);
        let results = engine.query_nearest_k(&query, 2);

        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_bbox_volume() {
        let bbox = BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(2.0, 3.0, 4.0));
        let volume = bbox.volume();
        assert!((volume - 24.0).abs() < 1e-10);
    }

    #[test]
    fn test_bbox_center() {
        let bbox = BoundingBox::new(Point3D::new(0.0, 0.0, 0.0), Point3D::new(2.0, 4.0, 6.0));
        let center = bbox.center();
        assert!((center.x - 1.0).abs() < 1e-10);
        assert!((center.y - 2.0).abs() < 1e-10);
        assert!((center.z - 3.0).abs() < 1e-10);
    }
}
