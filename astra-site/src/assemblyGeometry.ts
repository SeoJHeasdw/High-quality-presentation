import * as THREE from 'three';

export type AssemblyPiece = {
  vertices: Uint32Array;
  center: THREE.Vector3;
  size: THREE.Vector3;
};

/**
 * Give the animator independent solids without adding a mesh or draw call per
 * solid. The returned vertex lists refer to the returned, privately owned clone.
 * Explicit strides are only appropriate for known contiguous exporter blocks
 * (the unbevelled house cuboids use 36 indices). Bevelled Blender boxes do not
 * retain that ordering, so they must use the connected-component fallback.
 */
export function splitAssemblyGeometry(
  source: THREE.BufferGeometry,
  indicesPerPiece?: number,
): { geometry: THREE.BufferGeometry; pieces: AssemblyPiece[] } {
  let geometry = source.clone();
  const sourcePosition = geometry.getAttribute('position');
  if (!sourcePosition || sourcePosition.count === 0) return { geometry, pieces: [] };

  const elementCount = geometry.index?.count ?? sourcePosition.count;
  const hasStride = indicesPerPiece !== undefined
    && Number.isInteger(indicesPerPiece)
    && indicesPerPiece > 0
    && indicesPerPiece % 3 === 0
    && elementCount % indicesPerPiece === 0;

  if (hasStride && geometry.index) {
    const indexed = geometry;
    geometry = indexed.toNonIndexed();
    geometry.name = indexed.name;
    geometry.userData = { ...indexed.userData };
    geometry.setDrawRange(indexed.drawRange.start, indexed.drawRange.count);
    geometry.boundingBox = indexed.boundingBox?.clone() ?? null;
    geometry.boundingSphere = indexed.boundingSphere?.clone() ?? null;
    indexed.dispose();
  }

  const position = geometry.getAttribute('position');
  const makePiece = (vertices: Uint32Array): AssemblyPiece => {
    const minimum = new THREE.Vector3(Infinity, Infinity, Infinity);
    const maximum = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const vertex of vertices) {
      const x = position.getX(vertex);
      const y = position.getY(vertex);
      const z = position.getZ(vertex);
      minimum.x = Math.min(minimum.x, x);
      minimum.y = Math.min(minimum.y, y);
      minimum.z = Math.min(minimum.z, z);
      maximum.x = Math.max(maximum.x, x);
      maximum.y = Math.max(maximum.y, y);
      maximum.z = Math.max(maximum.z, z);
    }
    return {
      vertices,
      center: minimum.clone().add(maximum).multiplyScalar(.5),
      size: maximum.sub(minimum),
    };
  };

  if (hasStride) {
    const pieces: AssemblyPiece[] = [];
    for (let start = 0; start < elementCount; start += indicesPerPiece) {
      const vertices = new Uint32Array(indicesPerPiece);
      for (let offset = 0; offset < indicesPerPiece; offset += 1) vertices[offset] = start + offset;
      pieces.push(makePiece(vertices));
    }
    return { geometry, pieces };
  }

  const parents = Uint32Array.from({ length: position.count }, (_, index) => index);
  const ranks = new Uint8Array(position.count);
  const root = (vertex: number) => {
    while (parents[vertex] !== vertex) {
      parents[vertex] = parents[parents[vertex]];
      vertex = parents[vertex];
    }
    return vertex;
  };
  const join = (a: number, b: number) => {
    let parentA = root(a);
    let parentB = root(b);
    if (parentA === parentB) return;
    if (ranks[parentA] < ranks[parentB]) [parentA, parentB] = [parentB, parentA];
    parents[parentB] = parentA;
    if (ranks[parentA] === ranks[parentB]) ranks[parentA] += 1;
  };
  const index = geometry.index;
  for (let element = 0; element + 2 < elementCount; element += 3) {
    const a = index ? index.getX(element) : element;
    const b = index ? index.getX(element + 1) : element + 1;
    const c = index ? index.getX(element + 2) : element + 2;
    join(a, b);
    join(a, c);
  }

  // glTF duplicates vertices along normal/UV/material seams. Weld only for
  // connectivity; keeping the actual attributes intact preserves those seams.
  // Adjacent spatial buckets cover positions close to a quantization boundary.
  const tolerance = 1e-5;
  const toleranceSquared = tolerance * tolerance;
  const buckets = new Map<string, number[]>();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    const bx = Math.floor(x / tolerance);
    const by = Math.floor(y / tolerance);
    const bz = Math.floor(z / tolerance);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const candidates = buckets.get(`${bx + dx},${by + dy},${bz + dz}`);
          if (!candidates) continue;
          for (const candidate of candidates) {
            const distanceX = position.getX(candidate) - x;
            const distanceY = position.getY(candidate) - y;
            const distanceZ = position.getZ(candidate) - z;
            if (distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ <= toleranceSquared) {
              join(vertex, candidate);
            }
          }
        }
      }
    }
    const key = `${bx},${by},${bz}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(vertex);
    else buckets.set(key, [vertex]);
  }

  const components = new Map<number, number[]>();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const parent = root(vertex);
    const component = components.get(parent);
    if (component) component.push(vertex);
    else components.set(parent, [vertex]);
  }
  const pieces = [...components.values()].map((vertices) => makePiece(Uint32Array.from(vertices)));
  return { geometry, pieces };
}
