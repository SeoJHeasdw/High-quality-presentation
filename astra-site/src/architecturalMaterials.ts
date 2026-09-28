import * as THREE from 'three';

/** Small, local material maps keep the model self-contained and avoid network textures. */
export function architecturalFinishes() {
  const resources: THREE.Texture[] = [];
  const makeSurface = (kind: 'stone' | 'wood' | 'fabric' | 'water') => {
    const side = 512;
    const bytes = new Uint8Array(side * side * 4);
    let seed = 9137;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const noise = random() - .5;
      let value = 0;
      if (kind === 'wood') {
        const grain = Math.sin(x * .85 + Math.sin(y * .018) * 1.6 + Math.sin(x * .055) * 3);
        value = 224 + grain * 10 + noise * 13 + Math.sin(x * .035) * 8;
      } else if (kind === 'fabric') {
        value = 232 + Math.sin(x * Math.PI) * 4 + (x % 3 === 0 || y % 3 === 0 ? -10 : 0) + noise * 14;
      } else if (kind === 'water') {
        value = 128 + Math.sin(x * .092 + Math.sin(y * .04) * 3) * 27 + Math.sin(y * .07 + x * .014) * 18;
      } else {
        value = 234 + noise * 15 + Math.sin(x * .041 + y * .017) * 3 + (random() > .994 ? -30 : 0);
      }
      const i = (y * side + x) * 4;
      bytes[i] = bytes[i + 1] = bytes[i + 2] = Math.round(value);
      bytes[i + 3] = 255;
    }
    const texture = new THREE.DataTexture(bytes, side, side, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    resources.push(texture);
    return texture;
  };
  const stone = makeSurface('stone');
  const wood = makeSurface('wood');
  const fabric = makeSurface('fabric');
  const water = makeSurface('water');

  const apply = (source: THREE.Material): THREE.MeshStandardMaterial => {
    const original = source as THREE.MeshStandardMaterial;
    const finish = new THREE.MeshPhysicalMaterial();
    finish.name = source.name;
    finish.color.copy(original.color);
    finish.opacity = source.opacity;
    finish.transparent = source.transparent;
    finish.depthWrite = source.depthWrite;
    finish.side = THREE.DoubleSide;
    finish.roughness = .7;
    finish.envMapIntensity = .8;
    const name = source.name.toLowerCase();
    if (/glass/.test(name)) {
      finish.color.set('#b8c2bd');
      finish.metalness = .32;
      finish.roughness = .075;
      finish.opacity = .25;
      finish.transparent = true;
      finish.depthWrite = false;
      finish.envMapIntensity = 1.8;
      finish.clearcoat = 1;
      finish.clearcoatRoughness = .035;
      finish.side = THREE.FrontSide;
    } else if (/reflecting pool/.test(name)) {
      finish.color.set('#40686a');
      finish.metalness = .48;
      finish.roughness = .1;
      finish.opacity = .88;
      finish.transparent = true;
      finish.depthWrite = false;
      finish.bumpMap = water;
      finish.bumpScale = .015;
      finish.envMapIntensity = 1.4;
      finish.clearcoat = 1;
    } else if (/cedar|oak|walnut/.test(name)) {
      finish.color.set(name.includes('walnut') ? '#473526' : name.includes('cedar') ? '#886043' : '#a7835c');
      finish.map = wood;
      finish.bumpMap = wood;
      finish.bumpScale = .018;
      finish.roughness = .61;
      finish.clearcoat = .12;
    } else if (/bronze/.test(name)) {
      finish.color.set('#514b41');
      finish.metalness = .85;
      finish.roughness = .27;
    } else if (/linen/.test(name)) {
      finish.color.set('#c3bcac');
      finish.map = fabric;
      finish.bumpMap = fabric;
      finish.bumpScale = .025;
      finish.roughness = 1;
      finish.sheen = .6;
      finish.sheenColor.set('#ded6c7');
    } else if (/glow|led|downlight|diffuser/.test(name)) {
      finish.color.set('#ffdfab');
      finish.emissive.set('#ffc57e');
      finish.emissiveIntensity = name.includes('glow') ? 2.3 : 1.35;
      finish.roughness = .35;
    } else if (/roof membrane/.test(name)) {
      finish.color.set('#434642');
      finish.map = stone;
      finish.bumpMap = stone;
      finish.bumpScale = .035;
      finish.roughness = .84;
    } else if (/pool tile/.test(name)) {
      finish.color.set('#5c8380');
      finish.roughness = .31;
      finish.map = stone;
    } else {
      finish.color.set(name.includes('plinth') ? '#77756b' : name.includes('plaster') ? '#d6cebc' : name.includes('kitchen') ? '#aea798' : '#c3bdad');
      finish.map = stone;
      finish.bumpMap = stone;
      finish.bumpScale = name.includes('board') ? .052 : .023;
      finish.roughness = name.includes('kitchen') ? .32 : .81;
    }
    return finish;
  };
  return { apply, resources };
}

export function addArchitecturalUVs(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute('uv')) return;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i)), nz = Math.abs(normals.getZ(i));
    if (ny > nx && ny > nz) { uv[i * 2] = x * .46; uv[i * 2 + 1] = z * .46; }
    else if (nx > nz) { uv[i * 2] = z * .46; uv[i * 2 + 1] = y * .46; }
    else { uv[i * 2] = x * .46; uv[i * 2 + 1] = y * .46; }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
