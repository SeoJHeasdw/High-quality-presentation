import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addArchitecturalUVs } from './architecturalMaterials';
import { splitAssemblyGeometry } from './assemblyGeometry';

type Box = [number, number, number, number, number, number];
type Flight = {
  vertices: Uint32Array;
  center: THREE.Vector3;
  origin: THREE.Vector3;
  controlA: THREE.Vector3;
  controlB: THREE.Vector3;
  rotation: THREE.Quaternion;
  turn: THREE.Quaternion;
  start: number;
  duration: number;
  last: number;
};
type AnimatedMesh = {
  mesh: THREE.Mesh;
  position: THREE.BufferAttribute;
  normal: THREE.BufferAttribute;
  rest: Float32Array;
  normals: Float32Array;
  flights: Flight[];
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const smoother = (n: number) => { const t = clamp(n); return t * t * t * (t * (t * 6 - 15) + 10); };
const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function boxesGeometry(boxes: Box[]) {
  const pieces = boxes.map(([x0, x1, y0, y1, z0, z1]) =>
    new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  const geometry = mergeGeometries(pieces, false)!;
  pieces.forEach((piece) => piece.dispose());
  geometry.deleteAttribute('uv');
  addArchitecturalUVs(geometry);
  return geometry;
}

/** Panel joints coincide with the existing envelope; the final house keeps its silhouette. */
function panelize(box: Box, count: number, axis: 0 | 4 = 0): Box[] {
  const width = (box[axis + 1] - box[axis]) / count;
  return Array.from({ length: count }, (_, index) => {
    const panel: Box = [...box];
    panel[axis] = box[axis] + width * index;
    panel[axis + 1] = box[axis] + width * (index + 1);
    return panel;
  });
}

function meshName(mesh: THREE.Mesh) {
  // GLTFLoader creates a Group with suffixed mesh children for multi-material solids.
  if (mesh.name.startsWith('structure_')) return mesh.name;
  const parent = mesh.parent;
  return parent && !parent.name.startsWith('part_') && parent.type === 'Group'
    ? parent.name : mesh.name;
}

/** Convert only monolithic surfaces to fabrication-sized panels, using source-house dimensions. */
function architecturalPanels(name: string, material: THREE.Material): Box[] | undefined {
  const finish = material.name;
  if (name === 'core') return [
    [-11, -9.7, .7, 8.7, -4.8, 4.8], [-8.9, -7.5, .7, 8.7, -4.8, 4.8],
    [-9.7, -8.9, .7, 1.25, -4.8, 4.8], [-9.7, -8.9, 8.05, 8.7, -4.8, 4.8],
    [-9.7, -8.9, 1.25, 8.05, -4.8, 4.2],
  ];
  if (name === 'slab') return panelize([-7.5, 9.2, 4.1, 4.5, -5.2, 5.2], 8);
  if (name === 'ground_back_wall') return panelize([-7.5, 7, .7, 4.1, -4.2, -4], 7);
  if (name === 'ground_glazing') return [
    ...panelize([-7.5, 7, .72, 4.1, 4.18, 4.2], 8),
    ...panelize([6.98, 7, .72, 4.1, -4, 4.18], 5, 4),
  ];
  if (name === 'upper_glazing') return [
    ...panelize([.5, 13, 5.2, 7.6, 3.7, 3.72], 6),
    ...panelize([16.98, 17, 4.72, 8.1, -3.7, 3.7], 3, 4),
  ];
  if (name === 'upper_shell') {
    if (finish.includes('slab concrete')) return panelize([-7.5, 17, 4.5, 4.72, -3.7, 3.7], 10);
    if (finish.includes('oak floor')) return panelize([-7.4, 16.9, 4.72, 4.74, -3.45, 3.45], 10);
    return [
      ...panelize([-7.5, 17, 4.72, 8.1, -3.7, -3.5], 10),
      ...panelize([-7.5, .5, 4.72, 8.1, 3.5, 3.7], 4),
      ...panelize([13, 17, 4.72, 8.1, 3.5, 3.7], 2),
      ...panelize([.5, 13, 4.72, 5.2, 3.5, 3.7], 6),
      ...panelize([.5, 13, 7.6, 8.1, 3.5, 3.7], 6),
      ...panelize([-7.5, 17, 7.92, 8.1, -3.5, 3.5], 10),
    ];
  }
  if (name === 'roof') {
    if (finish.includes('roof membrane')) return panelize([-7.7, 17.4, 8.1, 8.36, -4.1, 4.1], 10);
    return [
      ...panelize([-7.75, 17.45, 8.05, 8.44, 4.08, 4.15], 5),
      ...panelize([-7.75, 17.45, 8.05, 8.44, -4.15, -4.08], 5),
      [17.38, 17.45, 8.05, 8.44, -4.15, 4.15], [-7.75, -7.68, 8.05, 8.44, -4.15, 4.15],
    ];
  }
  if (name === 'pool_coping') return finish.includes('pool tile')
    ? panelize([3, 19, 0, .06, 8.4, 12.2], 8)
    : [...panelize([-2, 21, 0, .45, 12.2, 13.6], 10), ...panelize([-2, 3, 0, .45, 8.4, 12.2], 3), [19, 21, 0, .45, 8.4, 12.2]];
  return undefined;
}

function addSkeleton(house: THREE.Object3D, material: THREE.Material, registerGeometry: (g: THREE.BufferGeometry) => void) {
  const add = (name: string, boxes: Box[]) => {
    const geometry = boxesGeometry(boxes);
    registerGeometry(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    house.add(mesh);
  };
  const groundColumns: Box[] = [];
  for (const x of [-7.28, -.26, 6.78]) for (const z of [-3.78, 3.97])
    groundColumns.push([x - .1, x + .1, .72, 4.08, z - .1, z + .1]);
  add('structure_ground_columns', groundColumns);
  const groundBeams: Box[] = [];
  for (const z of [-3.78, 3.97]) for (const [x0, x1] of [[-7.38, -.26], [-.26, 6.88]])
    groundBeams.push([x0, x1, 3.86, 4.1, z - .12, z + .12]);
  for (const x of [-7.28, -.26, 6.78]) groundBeams.push([x - .1, x + .1, 3.9, 4.1, -3.78, 3.97]);
  add('structure_ground_beams', groundBeams);
  const upperColumns: Box[] = [];
  for (const x of [-7.28, .58, 6.75, 12.9, 16.78]) for (const z of [-3.36, 3.36])
    upperColumns.push([x - .075, x + .075, 4.72, 7.92, z - .075, z + .075]);
  add('structure_upper_columns', upperColumns);
  const upperBeams: Box[] = [];
  for (const z of [-3.36, 3.36]) for (const [x0, x1] of [[-7.35, .58], [.58, 6.75], [6.75, 12.9], [12.9, 16.85]])
    upperBeams.push([x0, x1, 7.73, 7.92, z - .1, z + .1]);
  for (const x of [-7.28, .58, 6.75, 12.9, 16.78]) upperBeams.push([x - .08, x + .08, 7.76, 7.92, -3.36, 3.36]);
  add('structure_upper_beams', upperBeams);
}

type Timing = { start: number; end: number; duration: number; travel: number; mode: 'column' | 'beam' | 'panel' | 'glass' | 'slat' | 'small' | 'water' };
function timing(name: string, center: THREE.Vector3, size: THREE.Vector3, finish: string): Timing {
  const t = (start: number, end: number, duration: number, travel: number, mode: Timing['mode']): Timing => ({ start, end, duration, travel, mode });
  if (name === 'plinth') return t(-1, -1, 0, 0, 'panel');
  if (name === 'core') return t(.01, .115, .055, 4.5, 'panel');
  if (name === 'core_slot_light') return t(.11, .13, .025, 1, 'small');
  if (name === 'structure_ground_columns') return t(.025, .19, .095, 8.5, 'column');
  if (name === 'structure_ground_beams') return t(.13, .26, .085, 7, 'beam');
  if (name === 'ground_frame') return size.y > 1 ? t(.18, .295, .055, 5.5, 'column') : t(.245, .325, .05, 4, 'beam');
  if (name === 'ground_back_wall') return t(.24, .335, .055, 4, 'panel');
  if (name === 'ground_glazing') return t(.29, .385, .06, 4, 'glass');
  if (name === 'ground_interior') return t(.29, .405, .045, 2.5, 'small');
  if (name === 'slab') return t(.32, .425, .065, 5.8, 'panel');
  if (name === 'slab_downlights') return t(.415, .445, .025, 1, 'small');
  if (/dining_pendants|floor_lamp/.test(name)) return t(.39, .45, .04, 2.5, 'small');
  if (name === 'upper_shell') {
    if (/slab concrete|oak floor/.test(finish)) return t(.395, .46, .045, 4.8, 'panel');
    if (size.y < .3 && center.y > 7) return t(.65, .725, .05, 4, 'panel');
    return t(.50, .60, .055, 4.5, 'panel');
  }
  if (name === 'structure_upper_columns') return t(.425, .515, .055, 5.5, 'column');
  if (name === 'structure_upper_beams') return t(.49, .56, .045, 4.5, 'beam');
  if (name === 'upper_frame') return size.y > 1 ? t(.525, .60, .045, 4.5, 'column') : t(.575, .625, .04, 3.5, 'beam');
  if (name === 'upper_glazing') return t(.60, .70, .055, 4.5, 'glass');
  if (name === 'cedar_slats') return size.y < .3 && size.x > 4
    ? t(.645, .74, .05, 2.8, 'beam')
    : t(.545, .745, .027, 3.5, 'slat');
  if (name === 'upper_room') return t(.55, .645, .05, 3, 'small');
  if (name === 'books') return t(.59, .67, .018, .3, 'small');
  if (/diffusers|desk_lamp|bedside_lamp|cantilever_downlights/.test(name)) return t(.65, .72, .035, 2, 'small');
  if (name === 'roof') return t(.70, .795, .06, 5, 'panel');
  if (name === 'roof_edge_led') return t(.785, .82, .025, 1, 'small');
  if (name === 'deck_boards') return t(.78, .88, .055, 4, 'beam');
  if (name === 'pool_coping') return t(.825, .92, .055, 3, 'panel');
  if (name === 'water') return t(.91, .96, .05, .35, 'water');
  if (name === 'loungers') return t(.92, .98, .045, 2, 'small');
  return t(.55, .66, .05, 2, 'small');
}

/** Curated flight families: a fan of uprights, crossing beams, ribbons and hinged glass. */
function flightPath(name: string, config: Timing, center: THREE.Vector3, size: THREE.Vector3, index: number, order: number, seed: number) {
  const d = config.travel;
  const front = center.z >= 0 ? 1 : -1;
  const hand = index % 2 === 0 ? 1 : -1;
  const r = random(seed);
  const origin = new THREE.Vector3();
  const controlA = new THREE.Vector3();
  const controlB = new THREE.Vector3();
  const initial = new THREE.Euler();
  const middle = new THREE.Euler();
  if (config.mode === 'column') {
    // Uprights arrive from four corners, turn upright in the air, then gently seat.
    const lane = index % 4;
    const angle = [-.72, 2.25, .7, 3.85][lane];
    origin.set(Math.cos(angle) * d, d * [ .15, .23, .32, .18 ][lane], Math.sin(angle) * d * .8);
    controlA.set(origin.x * .48 - Math.sin(angle) * d * .38, d * (.25 + r * .12), origin.z * .5 + Math.cos(angle) * d * .32);
    controlB.set(hand * .18, .35, front * .15);
    initial.set(front * .24, hand * .45, hand * (.68 + r * .22));
    middle.set(-front * .10, -hand * .16, -hand * .20);
  } else if (config.mode === 'beam') {
    // Long members glide in opposing arcs, opening into their final orientation.
    const alongX = size.x > size.z;
    origin.set(alongX ? hand * d * 1.3 : front * d * .35, d * (.15 + .22 * r), alongX ? front * d * .35 : hand * d * 1.3);
    controlA.set(alongX ? hand * d * .36 : -front * d * .28, d * .38, alongX ? -front * d * .28 : hand * d * .36);
    controlB.set(alongX ? hand * .35 : 0, .18, alongX ? 0 : hand * .35);
    initial.set(front * .18, hand * (.32 + .25 * r), hand * .2);
    middle.set(-front * .07, -hand * .12, -hand * .06);
  } else if (config.mode === 'glass') {
    // The glass opens like a leaf; the last part of the path is normal to the facade.
    const isEndWall = size.x < size.z;
    origin.set(isEndWall ? d * 1.35 : hand * d * .75, .3 + r * .9, isEndWall ? hand * d * .5 : front * d * 1.5);
    controlA.set(isEndWall ? d * .95 : -hand * d * .22, d * .48, isEndWall ? -hand * d * .3 : front * d * .9);
    controlB.set(isEndWall ? .8 : 0, .08, isEndWall ? 0 : front * .8);
    initial.set(front * .12, (isEndWall ? -1 : front) * (.8 + r * .25), hand * .12);
    middle.set(0, -front * .12, 0);
  } else if (config.mode === 'slat') {
    // Adjacent strips describe a continuous helix, rather than a cloud of random parts.
    const wave = order * Math.PI * 2.4;
    const angle = wave + (front > 0 ? .4 : Math.PI);
    origin.set(Math.cos(angle) * d * 1.45, 1.1 + (Math.sin(wave) + 1) * d * .30, front * d * (1.2 + Math.sin(wave) * .35));
    controlA.set(-Math.sin(angle) * d * .7, d * .65, front * d * .62);
    controlB.set(.10 * Math.cos(wave), .10, front * .48);
    initial.set(front * .2, front * (.35 + Math.sin(wave) * .20), .7 * Math.cos(wave));
    middle.set(0, -front * .08, -.10 * Math.cos(wave));
  } else if (config.mode === 'panel') {
    const horizontal = size.y < Math.max(size.x, size.z) * .2;
    if (horizontal) {
      // Alternating leaves unfold from either side in a controlled fan.
      origin.set(hand * d * 1.35, d * (.22 + r * .18), front * d * .65);
      controlA.set(hand * d * .65, d * .5, -front * d * .25);
      controlB.set(hand * .3, .25, 0);
      initial.set(front * .24, hand * .22, hand * .55);
      middle.set(-front * .06, 0, -hand * .12);
    } else {
      origin.set(hand * d * 1.5, d * .22, front * d * .7);
      controlA.set(hand * d * .4, d * .35, -front * d * .4);
      controlB.set(hand * .6, .18, front * .12);
      initial.set(front * .08, hand * .88, hand * .13);
      middle.set(0, -hand * .12, 0);
    }
  } else if (config.mode === 'water') {
    origin.set(0, -.25, 0); controlA.set(0, -.22, 0); controlB.set(0, -.08, 0);
  } else {
    // Interior details orbit into place in restrained, low arcs.
    const angle = (index % 5) / 5 * Math.PI * 2;
    origin.set(Math.cos(angle) * d, d * (.25 + r * .3), Math.sin(angle) * d);
    controlA.set(-Math.sin(angle) * d * .35, d * .65, Math.cos(angle) * d * .35);
    controlB.set(0, .18, 0);
    initial.set(.08 * front, hand * .5, hand * .10);
    middle.set(0, -hand * .06, 0);
  }
  if (name === 'roof') {
    // The roof closes as a single fan from the rear, allowing the interior to stay visible.
    origin.set((order - .5) * d * 1.4, d * .38, -d * 1.35);
    controlA.set((order - .5) * d * .6, d * .55, -d * .55);
    controlB.set(0, .25, -.2);
    initial.set(-.42, (order - .5) * .30, (order - .5) * .45);
    middle.set(.07, 0, 0);
  }
  if (name === 'deck_boards') {
    origin.set(hand * 6, 1.2 + r * .4, 1.5);
    controlA.set(hand * 3.2, 1.5, -.65);
    controlB.set(hand * .45, .12, 0);
    initial.set(.07, hand * .22, hand * .05);
    middle.set(0, -hand * .035, 0);
  }
  return {
    origin, controlA, controlB,
    rotation: new THREE.Quaternion().setFromEuler(initial),
    turn: new THREE.Quaternion().setFromEuler(middle),
  };
}

/** Each original draw call carries many independent, reversible rigid-body flights. */
export function createHouseAssembly(house: THREE.Object3D, registerGeometry: (g: THREE.BufferGeometry) => void) {
  const frame = house.getObjectByName('ground_frame') as THREE.Mesh;
  const frameMaterial = Array.isArray(frame.material) ? frame.material[0] : frame.material;
  addSkeleton(house, frameMaterial, registerGeometry);
  const meshes: THREE.Mesh[] = [];
  house.traverse((object) => { if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh); });
  const animated: AnimatedMesh[] = [];
  let pieceCount = 0;
  for (const mesh of meshes) {
    const name = meshName(mesh);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const panels = architecturalPanels(name, material);
    if (panels) {
      mesh.geometry = boxesGeometry(panels);
      registerGeometry(mesh.geometry);
    }
    const isBox = !!panels || /^(structure_|ground_frame|upper_frame|cedar_slats|deck_boards|books|dining_pendants|.*downlights|upper_diffusers|.*lamp$|floor_lamp_shade|roof_edge_led)/.test(name);
    const { geometry, pieces } = splitAssemblyGeometry(mesh.geometry, isBox ? 36 : undefined);
    mesh.geometry = geometry;
    registerGeometry(geometry);
    mesh.frustumCulled = false;
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = true;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
    position.setUsage(THREE.DynamicDrawUsage);
    normal.setUsage(THREE.DynamicDrawUsage);
    const rest = new Float32Array(position.array);
    const normals = new Float32Array(normal.array);
    // Sweep across the facade instead of using the exporter's arbitrary face order.
    pieces.sort((a, b) => a.center.x - b.center.x || b.center.z - a.center.z || a.center.y - b.center.y);
    const flights = pieces.map((piece, index): Flight => {
      const config = timing(name, piece.center, piece.size, material.name);
      const order = pieces.length > 1 ? index / (pieces.length - 1) : 0;
      const seed = pieceCount++;
      return {
        vertices: piece.vertices, center: piece.center,
        ...flightPath(name, config, piece.center, piece.size, index, order, seed),
        start: config.start + order * Math.max(0, config.end - config.start - config.duration),
        duration: config.duration, last: -2,
      };
    });
    animated.push({ mesh, position, normal, rest, normals, flights });
  }
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  const translation = new THREE.Vector3();
  const v = new THREE.Vector3();
  let lastReducedMotion: boolean | undefined;
  return {
    pieceCount,
    update(progress: number, reducedMotion: boolean) {
      const motionChanged = lastReducedMotion !== reducedMotion;
      lastReducedMotion = reducedMotion;
      for (const entry of animated) {
        const positions = entry.position.array as Float32Array;
        const normals = entry.normal.array as Float32Array;
        let dirty = false;
        let visible = false;
        for (const piece of entry.flights) {
          const t = piece.start < 0 ? 1 : clamp((progress - piece.start) / piece.duration);
          visible ||= t > 0;
          if (!motionChanged && Math.abs(piece.last - t) < .000001) continue;
          piece.last = t;
          dirty = true;
          const u = smoother(t);
          const inverse = 1 - u;
          const scale = smooth(t / (reducedMotion ? 1 : .045));
          translation.copy(piece.origin).multiplyScalar(inverse ** 3)
            .addScaledVector(piece.controlA, 3 * inverse * inverse * u)
            .addScaledVector(piece.controlB, 3 * inverse * u * u);
          // Rotation resolves slightly ahead of translation for a precise, quiet landing.
          const turnAt = .46;
          if (t < turnAt) rotation.slerpQuaternions(piece.rotation, piece.turn, smooth(t / turnAt));
          else rotation.slerpQuaternions(piece.turn, identity, smoother((t - turnAt) / (.82 - turnAt)));
          if (reducedMotion) { rotation.identity(); translation.set(0, 0, 0); }
          matrix.makeRotationFromQuaternion(rotation);
          const elements = matrix.elements;
          for (const vertex of piece.vertices) {
            const i = vertex * 3;
            if (t === 1) {
              positions[i] = entry.rest[i]; positions[i + 1] = entry.rest[i + 1]; positions[i + 2] = entry.rest[i + 2];
              normals[i] = entry.normals[i]; normals[i + 1] = entry.normals[i + 1]; normals[i + 2] = entry.normals[i + 2];
              continue;
            }
            v.set(entry.rest[i] - piece.center.x, entry.rest[i + 1] - piece.center.y, entry.rest[i + 2] - piece.center.z).applyMatrix4(matrix).multiplyScalar(scale);
            positions[i] = v.x + piece.center.x + translation.x;
            positions[i + 1] = v.y + piece.center.y + translation.y;
            positions[i + 2] = v.z + piece.center.z + translation.z;
            const x = entry.normals[i], y = entry.normals[i + 1], z = entry.normals[i + 2];
            normals[i] = elements[0] * x + elements[4] * y + elements[8] * z;
            normals[i + 1] = elements[1] * x + elements[5] * y + elements[9] * z;
            normals[i + 2] = elements[2] * x + elements[6] * y + elements[10] * z;
          }
        }
        entry.mesh.visible = visible;
        if (dirty) { entry.position.needsUpdate = true; entry.normal.needsUpdate = true; }
      }
    },
  };
}
