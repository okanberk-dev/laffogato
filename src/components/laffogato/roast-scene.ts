import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  PointsMaterial,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";

/**
 * The home page's three live drawings (operator, 11 Kas 2026: the landing
 * takes the look of coffee-beans-swart.vercel.app, "three js ... birebir").
 * That page plays pre-rendered film: a frame sequence scrubbed by the scroll
 * in the hero, two looping clips below. These are the same three moments
 * drawn live, with models built here from arithmetic - no file is loaded
 * and nothing is taken from the reference:
 *
 * - `bean`     the hero: one roasted bean wakes, cracks along its crease on a
 *              golden light, bursts into espresso and settles as a moka pot
 *              between two beans. Driven by the scroll (`setProgress`).
 * - `pour`     a portafilter's stream twisting down into a fluted cup.
 * - `affogato` the house's own cup: espresso poured from a small pitcher
 *              over fior di latte in the waffle cup you eat afterwards.
 *
 * This module is the only one on the site that imports three, and it is
 * only ever reached through `import()` (roast-stage.tsx), so three never
 * enters a first-load bundle (tests/home-roast.test.ts,
 * tests/client-bundle-weight.test.ts).
 *
 * How they are lit. A product photograph's studio is built once per canvas
 * out of plain geometry - a dome that is bright overhead and dark underfoot,
 * a large softbox, a key strip, a rim strip, a black flag - and baked into
 * the environment every material reflects: it is what gives the aluminium
 * its hard facets, the espresso its long highlights and the glass its rim.
 * One warm key light adds form and, on a desktop, real soft shadows (the
 * stream on the crema, the scoop on the wafer, the handle on the pot).
 * Depth is drawn, not post-processed: a haze the colour of the page takes
 * the far beans, motes drift in the light, and the camera leans a little
 * toward the pointer so near and far slide past each other.
 *
 * A drawing never runs unseen: the loop holds while the canvas is off
 * screen, the tab is hidden, or the visitor has paused it (WCAG 2.2.2);
 * under prefers-reduced-motion it is one still frame. A phone (`lite`) gets
 * the same picture with fewer segments and particles, a lower pixel ratio,
 * no shadow pass and no pointer.
 */

export type RoastKind = "bean" | "pour" | "affogato";

export interface RoastOptions {
  canvas: HTMLCanvasElement;
  /** Created by the caller, so a browser without WebGL 2 never downloads this. */
  context: WebGL2RenderingContext;
  kind: RoastKind;
  /** A phone: fewer segments, fewer drops, a lower pixel ratio. */
  lite: boolean;
  /** prefers-reduced-motion: one still frame, no loop. */
  still: boolean;
  onReady: () => void;
  onLost: () => void;
}

export interface RoastHandle {
  /** The hero's scroll, 0..1. The other two drawings ignore it. */
  setProgress: (progress: number) => void;
  /** The visitor's pause control (WCAG 2.2.2). */
  setPaused: (on: boolean) => void;
  dispose: () => void;
}

const MAX_PIXEL_RATIO = 1.5;
/** A tall band at 1.5x would be a 4-megapixel canvas: cap the backing store. */
const MAX_PIXELS = 2_600_000;

/* ───────────── small arithmetic ───────────── */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Where `p` stands between `a` and `b`, clamped. */
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutBack = (x: number) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const lerp = MathUtils.lerp;

/** A seeded generator: the drawings are the same on every visit. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────── the kit every drawing shares ───────────── */

/** Everything a drawing allocates, so `dispose` can give it all back. */
class Bin {
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  g<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
  m<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
  t<T extends Texture>(texture: T): T {
    this.textures.push(texture);
    return texture;
  }
  empty() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
  }
}

/** A square canvas painted once and handed to the GPU. */
function paint(
  bin: Bin,
  size: number,
  colour: boolean,
  draw: (g: CanvasRenderingContext2D, size: number) => void,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) draw(g, size);
  const texture = bin.t(new CanvasTexture(canvas));
  if (colour) texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round shadow to sit a cup on: the scene casts no real ones. */
function shadowTexture(bin: Bin) {
  return paint(bin, 128, true, (g, s) => {
    const fade = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    fade.addColorStop(0, "rgba(35,18,11,0.55)");
    fade.addColorStop(0.55, "rgba(35,18,11,0.2)");
    fade.addColorStop(1, "rgba(35,18,11,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, s, s);
  });
}

/** The golden light inside the bean. */
function glowTexture(bin: Bin) {
  return paint(bin, 256, true, (g, s) => {
    const fade = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    fade.addColorStop(0, "rgba(255,244,196,1)");
    fade.addColorStop(0.22, "rgba(250,200,92,0.92)");
    fade.addColorStop(0.55, "rgba(232,150,58,0.42)");
    fade.addColorStop(1, "rgba(222,133,58,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, s, s);
  });
}

/** A four-pointed spark. */
function sparkTexture(bin: Bin) {
  return paint(bin, 128, true, (g, s) => {
    const c = s / 2;
    g.translate(c, c);
    g.fillStyle = "#e9a744";
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? c * 0.94 : c * 0.2;
      const a = (i / 8) * Math.PI * 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
}

/** A soft round dot: a mote of dust, a grain of coffee. */
function dotTexture(bin: Bin) {
  return paint(bin, 32, true, (g, s) => {
    const fade = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    fade.addColorStop(0, "rgba(255,255,255,1)");
    fade.addColorStop(0.5, "rgba(255,255,255,0.6)");
    fade.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = fade;
    g.fillRect(0, 0, s, s);
  });
}

/** A wisp of steam: a few soft puffs, in a warm grey that shows on cream. */
function wispTexture(bin: Bin) {
  const rand = seeded(3);
  return paint(bin, 128, true, (g, s) => {
    for (let i = 0; i < 10; i++) {
      const x = s * (0.3 + 0.4 * rand());
      const y = s * (0.14 + 0.72 * rand());
      const r = s * (0.12 + 0.2 * rand());
      const fade = g.createRadialGradient(x, y, 0, x, y, r);
      fade.addColorStop(0, "rgba(128,108,90,0.5)");
      fade.addColorStop(1, "rgba(128,108,90,0)");
      g.fillStyle = fade;
      g.fillRect(0, 0, s, s);
    }
  });
}

/**
 * The bean's skin: the fine furrows that run its length and the pores of a
 * dark roast, drawn once as a height field, then turned into a normal map
 * (so the light catches every ridge) and a roughness map (a furrow is dull,
 * an oiled ridge shines).
 */
function beanSkin(bin: Bin) {
  const size = 256;
  const rand = seeded(11);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1100; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 10 + rand() * 46;
    const shade = rand() < 0.62 ? 58 + rand() * 50 : 150 + rand() * 60;
    g.strokeStyle = `rgba(${shade},${shade},${shade},${0.22 + rand() * 0.36})`;
    g.lineWidth = 0.7 + rand() * 1.9;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (rand() - 0.5) * 10, y + len / 2, x, y + len);
    g.stroke();
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(40,40,40,${0.2 + rand() * 0.35})`;
    g.beginPath();
    g.arc(rand() * size, rand() * size, 0.5 + rand() * 1.3, 0, 7);
    g.fill();
  }
  const source = g.getImageData(0, 0, size, size).data;
  const height = (x: number, y: number) =>
    source[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const normal = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * 2.2;
      const dy = (height(x, y + 1) - height(x, y - 1)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const k = (y * size + x) * 4;
      normal[k] = (-dx / len) * 127.5 + 127.5;
      normal[k + 1] = (-dy / len) * 127.5 + 127.5;
      normal[k + 2] = (1 / len) * 127.5 + 127.5;
      normal[k + 3] = 255;
      const dull = 255 * clamp01(0.52 + (0.5 - height(x, y)) * 0.9);
      rough[k] = rough[k + 1] = rough[k + 2] = dull;
      rough[k + 3] = 255;
    }
  }
  const map = (data: Uint8Array) => {
    const texture = bin.t(new DataTexture(data, size, size, RGBAFormat));
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  };
  return { normalMap: map(normal), roughnessMap: map(rough) };
}

/** Crema: the tawny foam on an espresso, with a slow swirl and a few bubbles. */
function cremaTexture(bin: Bin) {
  const rand = seeded(5);
  return paint(bin, 256, true, (g, s) => {
    const c = s / 2;
    const fade = g.createRadialGradient(c, c, 0, c, c, c);
    fade.addColorStop(0, "#b9773c");
    fade.addColorStop(0.6, "#8f5527");
    fade.addColorStop(1, "#4a2713");
    g.fillStyle = fade;
    g.fillRect(0, 0, s, s);
    g.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const r = 14 + rand() * (c - 26);
      const a0 = rand() * Math.PI * 2;
      g.strokeStyle = `rgba(232,190,132,${0.1 + rand() * 0.22})`;
      g.lineWidth = 1.5 + rand() * 5;
      g.beginPath();
      g.arc(c, c, r, a0, a0 + 0.6 + rand() * 1.8);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const r = rand() * (c - 16);
      const a = rand() * Math.PI * 2;
      g.fillStyle = `rgba(60,30,14,${0.15 + rand() * 0.25})`;
      g.beginPath();
      g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 0.8 + rand() * 2.2, 0, 7);
      g.fill();
    }
  });
}

/** The waffle cup's lattice: a colour map and, from the same drawing, a bump. */
function waffleTextures(bin: Bin) {
  const lattice =
    (base: string, line: string) =>
    (g: CanvasRenderingContext2D, s: number) => {
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = line;
      g.lineWidth = s / 22;
      const step = s / 4;
      for (let i = -4; i <= 8; i++) {
        g.beginPath();
        g.moveTo(i * step, 0);
        g.lineTo(i * step + s, s);
        g.stroke();
        g.beginPath();
        g.moveTo(i * step, 0);
        g.lineTo(i * step - s, s);
        g.stroke();
      }
    };
  const map = paint(bin, 256, true, lattice("#cf8f4c", "#9a5f2a"));
  const bump = paint(bin, 256, false, lattice("#b0b0b0", "#3c3c3c"));
  for (const texture of [map, bump]) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(5, 1.6);
  }
  return { map, bump };
}

/** Espresso and anything else that pours: dark, wet, mirror-coated. */
function liquid(bin: Bin, colour: number, vertexColors = false) {
  return bin.m(
    new MeshPhysicalMaterial({
      color: colour,
      vertexColors,
      roughness: 0.16,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.35,
    }),
  );
}

/** Glazed clay. */
function ceramic(bin: Bin, colour: number, roughness = 0.3) {
  return bin.m(
    new MeshPhysicalMaterial({
      color: colour,
      roughness,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1,
    }),
  );
}

/**
 * Glass that reads on a transparent canvas. Real transmission samples what
 * is drawn behind the glass, and behind this canvas is the page itself,
 * which the scene cannot see: it would come out as smoke. So the glass is a
 * near-clear shell whose opacity rises at grazing angles (the rim you see
 * on a real tumbler) and wherever the room's light glints off it.
 */
function glass(bin: Bin) {
  const material = bin.m(
    new MeshPhysicalMaterial({
      color: 0xcfc6ba,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.07,
      envMapIntensity: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float rim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
      float glint = smoothstep(1.25, 2.4, dot(outgoingLight, vec3(0.3333)));
      diffuseColor.a = clamp(diffuseColor.a + rim * 0.38 + glint * 0.85, 0.0, 0.9);
      #include <opaque_fragment>`,
    );
  };
  return material;
}

/**
 * A tube along a curve whose radius changes with the distance along it, and
 * which may be flattened into a ribbon and twisted: a pour, a splash, an
 * arc of light. Rings are ordered, so a draw range reveals it from one end.
 */
function ribbon(
  bin: Bin,
  curve: CatmullRomCurve3,
  rings: number,
  sides: number,
  radius: (u: number) => number,
  flatten = 1,
  twist: (u: number) => number = () => 0,
): BufferGeometry {
  const geometry = bin.g(new BufferGeometry());
  const count = (rings + 1) * (sides + 1);
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(count * 3), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(count * 3), 3),
  );
  const index: number[] = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  geometry.setIndex(index);
  shapeRibbon(geometry, curve, rings, sides, radius, flatten, twist);
  return geometry;
}

const POINT = new Vector3();

/** (Re)writes a ribbon's vertices: a pour that sways is reshaped each frame. */
function shapeRibbon(
  geometry: BufferGeometry,
  curve: CatmullRomCurve3,
  rings: number,
  sides: number,
  radius: (u: number) => number,
  flatten = 1,
  twist: (u: number) => number = () => 0,
) {
  const frames = curve.computeFrenetFrames(rings, false);
  const position = geometry.getAttribute("position") as BufferAttribute;
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    curve.getPointAt(u, POINT);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const r = radius(u);
    const turn = twist(u);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      // The cross-section, flattened on one axis, then turned about the path.
      const cx = Math.cos(a);
      const cy = Math.sin(a) * flatten;
      const x = cx * Math.cos(turn) - cy * Math.sin(turn);
      const y = cx * Math.sin(turn) + cy * Math.cos(turn);
      const k = i * (sides + 1) + j;
      position.setXYZ(
        k,
        POINT.x + r * (x * n.x + y * b.x),
        POINT.y + r * (x * n.y + y * b.y),
        POINT.z + r * (x * n.z + y * b.z),
      );
      // The flattened face's normal leans the other way: divide, not multiply.
      const nx = cx * flatten;
      const ny = Math.sin(a);
      const fx = nx * Math.cos(turn) - ny * Math.sin(turn);
      const fy = nx * Math.sin(turn) + ny * Math.cos(turn);
      const len = Math.hypot(fx, fy) || 1;
      normal.setXYZ(
        k,
        (fx * n.x + fy * b.x) / len,
        (fx * n.y + fy * b.y) / len,
        (fx * n.z + fy * b.z) / len,
      );
    }
  }
  position.needsUpdate = true;
  normal.needsUpdate = true;
}

/** A body of revolution from a profile of [radius, height] pairs. */
function lathe(bin: Bin, profile: Array<[number, number]>, segments: number) {
  return bin.g(
    new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      segments,
    ),
  );
}

/**
 * A body of revolution whose wall is fluted: the radius of the profile
 * points in `fluted` swells and narrows `flutes` times round the cup.
 */
function flutedLathe(
  bin: Bin,
  profile: Array<[number, number]>,
  segments: number,
  flutes: number,
  depth: number,
  fluted: (index: number) => boolean,
) {
  const geometry = bin.g(new BufferGeometry());
  const cols = segments + 1;
  const position = new Float32Array(profile.length * cols * 3);
  profile.forEach(([r, y], i) => {
    for (let j = 0; j < cols; j++) {
      const a = (j / segments) * Math.PI * 2;
      const swell = fluted(i) ? 1 + depth * Math.cos(a * flutes) : 1;
      const k = (i * cols + j) * 3;
      position[k] = Math.sin(a) * r * swell;
      position[k + 1] = y;
      position[k + 2] = Math.cos(a) * r * swell;
    }
  });
  const index: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * cols + j;
      const b = a + cols;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  weldSeam(geometry, profile.length, cols);
  return geometry;
}

/** The first and last column of a wrapped grid share a place: share a normal. */
function weldSeam(geometry: BufferGeometry, rows: number, cols: number) {
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  for (let i = 0; i < rows; i++) {
    const a = i * cols;
    const b = a + cols - 1;
    const x = normal.getX(a) + normal.getX(b);
    const y = normal.getY(a) + normal.getY(b);
    const z = normal.getZ(a) + normal.getZ(b);
    const len = Math.hypot(x, y, z) || 1;
    normal.setXYZ(a, x / len, y / len, z / len);
    normal.setXYZ(b, x / len, y / len, z / len);
  }
  normal.needsUpdate = true;
}

/* ───────────── the bean ───────────── */

interface BeanKit {
  whole: BufferGeometry;
  /** The two halves either side of the crease, sharing the whole's vertices. */
  halves: [BufferGeometry, BufferGeometry];
}

/**
 * A roasted coffee bean: an ellipsoid, flat on the belly, with the crease
 * pressed into it as a shallow S, raised lips either side, and the tips
 * bent back a little. The grid's two meridians on the crease split it into
 * halves, so the bean can open along the line it would crack on.
 */
function beanKit(bin: Bin, around: number, along: number): BeanKit {
  const cols = around + 1;
  const count = cols * (along + 1);
  const position = new Float32Array(count * 3);
  const colour = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const roast = new Color(0x5a2c14);
  const shade = new Color(0x1c0c06);
  const chaff = new Color(0xb08454);
  const tint = new Color();

  for (let i = 0; i <= along; i++) {
    const v = i / along;
    const theta = v * Math.PI;
    const st = Math.sin(theta);
    const sy = Math.cos(theta);
    for (let j = 0; j <= around; j++) {
      const u = j / around;
      const phi = u * Math.PI * 2;
      const sx = st * Math.cos(phi);
      const sz = st * Math.sin(phi);
      // 1 on the belly (the side facing +z), 0 on the back.
      const belly = smooth(clamp01((sz + 0.05) / 0.55));
      // 1 along the middle of the bean, falling to 0 at the tips.
      const body = 1 - Math.pow(Math.abs(sy), 2.6);
      let x = 0.7 * sx;
      const y = sy * (1 - 0.06 * sx * sx);
      let z = sz > 0 ? 0.33 * sz : 0.5 * sz;
      const groove = Math.exp(-Math.pow(x / 0.09, 2)) * body * belly;
      const lips =
        Math.exp(-Math.pow((Math.abs(x) - 0.16) / 0.075, 2)) * body * belly;
      z += 0.04 * lips - 0.26 * groove;
      x += 0.05 * Math.sin(y * 2.7) * belly * body;
      z -= 0.07 * y * y;
      const k = i * cols + j;
      position.set([x, y, z], k * 3);
      uv.set([u * 3, v * 2], k * 2);
      // Roast is never even: a slow mottle, periodic round the bean.
      const mottle =
        0.93 + 0.07 * Math.sin(phi * 5 + sy * 9) * Math.sin(sy * 13 + phi * 3);
      // The furrow is in shadow; at its very bottom lies a thread of
      // pale silverskin the roast did not take.
      const thread = Math.exp(-Math.pow((0.7 * sx) / 0.02, 2)) * body * belly;
      tint
        .copy(roast)
        .lerp(shade, Math.min(1, groove * 1.2))
        .lerp(chaff, thread * 0.5)
        .multiplyScalar(mottle);
      colour.set([tint.r, tint.g, tint.b], k * 3);
    }
  }

  const all: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * cols + j;
      const b = a + cols;
      const tris = [a, a + 1, b, a + 1, b + 1, b];
      all.push(...tris);
      // x < 0 between the quarter and three-quarter meridians.
      (j >= around / 4 && j < (3 * around) / 4 ? left : right).push(...tris);
    }
  }

  const whole = bin.g(new BufferGeometry());
  whole.setAttribute("position", new BufferAttribute(position, 3));
  whole.setAttribute("color", new BufferAttribute(colour, 3));
  whole.setAttribute("uv", new BufferAttribute(uv, 2));
  whole.setIndex(all);
  whole.computeVertexNormals();
  weldSeam(whole, along + 1, cols);

  const half = (index: number[]) => {
    const geometry = bin.g(new BufferGeometry());
    for (const name of ["position", "color", "uv", "normal"] as const) {
      geometry.setAttribute(name, whole.getAttribute(name));
    }
    geometry.setIndex(index);
    return geometry;
  };
  return { whole, halves: [half(left), half(right)] };
}

function beanMaterial(bin: Bin) {
  const skin = beanSkin(bin);
  return bin.m(
    new MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      // The map carries the furrows and pores; the coat is the roast's oil.
      roughness: skin ? 0.95 : 0.5,
      roughnessMap: skin?.roughnessMap ?? null,
      normalMap: skin?.normalMap ?? null,
      normalScale: new Vector2(0.6, 0.6),
      clearcoat: 0.4,
      clearcoatRoughness: 0.36,
      envMapIntensity: 0.9,
    }),
  );
}

/* ───────────── a drawing ───────────── */

interface Drawing {
  camera: PerspectiveCamera;
  /** Places things for the canvas's shape (a phone's hero is a tall slot). */
  layout: (aspect: number) => void;
  /** `time` in seconds of running clock; `progress` the hero's scroll. */
  update: (time: number, progress: number) => void;
  /** The frame a still drawing shows. */
  rest: { time: number; progress: number };
  /** How far the camera leans toward the pointer, across and up. */
  lean: [number, number];
  /** Half the width of the square the key light's shadow must cover. */
  reach: number;
}

/* ───────────── bean: the hero ───────────── */

function drawBean(scene: Scene, bin: Bin, lite: boolean): Drawing {
  const camera = new PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, 0, 8);
  const root = new Group();
  scene.add(root);

  const kit = beanKit(bin, lite ? 64 : 96, lite ? 40 : 64);
  const shell = beanMaterial(bin);
  // The inside of the shell is the light: seen only once the bean opens.
  const light = bin.m(
    new MeshBasicMaterial({ color: 0xffc04a, side: BackSide }),
  );

  /* The bean, as two halves hinged along its back. */
  const bean = new Group();
  const hinges = kit.halves.map((geometry) => {
    const hinge = new Group();
    hinge.position.z = -0.42;
    const body = new Group();
    body.position.z = 0.42;
    body.add(new Mesh(geometry, shell), new Mesh(geometry, light));
    hinge.add(body);
    bean.add(hinge);
    return hinge;
  });
  root.add(bean);

  /* The two whole beans it becomes. */
  const flanks = [-1, 1].map(() => {
    const mesh = new Mesh(kit.whole, shell);
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });

  /* The golden light, and the sparks it throws. */
  const glow = new Sprite(
    bin.m(
      new SpriteMaterial({
        map: glowTexture(bin),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  root.add(glow);
  const sparkMap = sparkTexture(bin);
  const sparks = [
    [1.05, 0.62, 0.17],
    [-0.98, -0.5, 0.12],
    [0.55, -0.82, 0.1],
    [-0.4, 0.9, 0.08],
  ].map(([x, y, size]) => {
    const sprite = new Sprite(
      bin.m(
        new SpriteMaterial({
          map: sparkMap,
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    sprite.userData = { x, y, size };
    root.add(sprite);
    return sprite;
  });

  /* Two thin amber arcs that circle the bean from the first frame. */
  const amber = bin.m(new MeshBasicMaterial({ color: 0xde853a }));
  const arcs = [
    { r: 0.98, tilt: 0.5, turn: 0.2, from: 0.1, len: 0.42 },
    { r: 1.22, tilt: -0.35, turn: 1.4, from: 0.55, len: 0.3 },
  ].map(({ r, tilt, turn, from, len }) => {
    const points: Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (from + (i / 24) * len) * Math.PI * 2;
      points.push(new Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.78, 0));
    }
    const curve = new CatmullRomCurve3(points);
    const mesh = new Mesh(
      ribbon(bin, curve, 48, 6, (u) => 0.012 * Math.sin(Math.PI * u) + 0.002),
      amber,
    );
    mesh.rotation.set(tilt, turn, 0);
    root.add(mesh);
    return mesh;
  });

  /* The burst: drops of espresso thrown outward, a few of which stay. */
  const rand = seeded(23);
  const DROPS = lite ? 60 : 120;
  const KEEP = lite ? 8 : 14;
  const drops = new InstancedMesh(
    bin.g(new IcosahedronGeometry(1, 2)),
    liquid(bin, 0x2a1307),
    DROPS,
  );
  drops.frustumCulled = false;
  root.add(drops);
  const plan = Array.from({ length: DROPS }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const lift = (rand() - 0.5) * 1.3;
    const dir = new Vector3(
      Math.cos(a),
      Math.sin(a) * 0.8 + lift * 0.25,
      lift,
    ).normalize();
    return {
      dir,
      reach: 0.6 + rand() * 2.2,
      size: 0.018 + Math.pow(rand(), 2.2) * 0.075,
      delay: rand() * 0.22,
      fall: 0.5 + rand() * 0.9,
      phase: rand() * 6.28,
      keep: i < KEEP,
    };
  });
  const dummy = new Object3D();

  /* The burst: four whips of espresso that lash out and are gone. */
  const espresso = liquid(bin, 0x2f1508);
  const RINGS = lite ? 40 : 64;
  const SIDES = 8;
  const whips = [0.3, 1.9, 3.4, 4.9].map((start, i) => {
    const sweep = i % 2 === 0 ? 1.6 : -1.4;
    const points: Vector3[] = [];
    for (let s = 0; s <= 5; s++) {
      const u = s / 5;
      const a = start + u * sweep;
      const r = 0.12 + u * (1.5 + i * 0.22);
      points.push(
        new Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.82, (u - 0.4) * 0.5),
      );
    }
    const mesh = new Mesh(
      ribbon(
        bin,
        new CatmullRomCurve3(points),
        RINGS,
        SIDES,
        (u) =>
          0.075 * Math.pow(1 - u, 0.7) +
          0.02 * Math.exp(-Math.pow((u - 0.93) / 0.05, 2)) +
          0.006,
      ),
      espresso,
    );
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });

  /* The moka pot: eight faces of polished aluminium, bakelite to hold. The
     boiler tapers straight to the waist, a turned collar joins it to the
     jug, whose front face is drawn out into the pouring lip; a low
     eight-sided lid, its knob on a stud, a brass safety valve. */
  const pot = new Group();
  const aluminium = bin.m(
    new MeshPhysicalMaterial({
      color: 0xe6e3de,
      metalness: 1,
      roughness: 0.2,
      flatShading: true,
      envMapIntensity: 1.3,
    }),
  );
  const turned = bin.m(
    new MeshPhysicalMaterial({
      color: 0xe6e3de,
      metalness: 1,
      roughness: 0.3,
      envMapIntensity: 1.2,
    }),
  );
  const bakelite = bin.m(
    new MeshPhysicalMaterial({
      color: 0x15100d,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    }),
  );
  const brassy = bin.m(
    new MeshStandardMaterial({ color: 0xc09a55, metalness: 1, roughness: 0.3 }),
  );
  const boiler = new Mesh(
    lathe(
      bin,
      [
        [0, -1.02],
        [0.63, -1.02],
        [0.68, -0.98],
        [0.68, -0.9],
        [0.515, -0.1],
        [0.5, -0.07],
      ],
      8,
    ),
    aluminium,
  );
  const collar = new Mesh(
    bin.g(new CylinderGeometry(0.535, 0.535, 0.075, 48)),
    turned,
  );
  collar.position.y = -0.035;
  const bead = new Mesh(bin.g(new TorusGeometry(0.535, 0.018, 8, 48)), turned);
  bead.rotation.x = Math.PI / 2;
  bead.position.y = 0.005;
  const jugGeometry = lathe(
    bin,
    [
      [0.5, 0],
      [0.52, 0.06],
      [0.715, 0.8],
      [0.74, 0.86],
      [0.715, 0.9],
    ],
    8,
  );
  {
    // The lip: the upper part of the face that looks toward -x is pulled
    // out and pinched to a point.
    const position = jugGeometry.getAttribute("position") as BufferAttribute;
    for (let k = 0; k < position.count; k++) {
      const x = position.getX(k);
      const y = position.getY(k);
      const z = position.getZ(k);
      const facing = Math.max(0, -x / (Math.hypot(x, z) || 1));
      const pull = Math.pow(facing, 5) * smooth(span(y, 0.55, 0.9));
      position.setXYZ(
        k,
        x * (1 + 0.42 * pull),
        y + 0.05 * pull,
        z * (1 - 0.35 * pull),
      );
    }
    position.needsUpdate = true;
    jugGeometry.computeVertexNormals();
  }
  const jug = new Mesh(jugGeometry, aluminium);
  const lid = new Mesh(
    lathe(
      bin,
      [
        [0.725, 0.9],
        [0.7, 0.935],
        [0.22, 1.05],
        [0, 1.06],
      ],
      8,
    ),
    aluminium,
  );
  const stud = new Mesh(
    bin.g(new CylinderGeometry(0.045, 0.06, 0.06, 16)),
    turned,
  );
  stud.position.y = 1.08;
  const knob = new Mesh(bin.g(new SphereGeometry(0.095, 20, 14)), bakelite);
  knob.position.y = 1.17;
  knob.scale.set(1, 0.82, 1);
  const handle = new Mesh(
    ribbon(
      bin,
      new CatmullRomCurve3(
        [
          new Vector3(0.68, 0.74, 0),
          new Vector3(1.0, 0.82, 0),
          new Vector3(1.22, 0.6, 0),
          new Vector3(1.2, 0.16, 0),
          new Vector3(1.02, -0.02, 0),
        ],
        false,
        "catmullrom",
        0.35,
      ),
      28,
      4,
      () => 0.09,
      0.6,
      () => Math.PI / 4,
    ),
    bakelite,
  );
  const bracket = new Mesh(
    bin.g(new CylinderGeometry(0.05, 0.05, 0.16, 12)),
    turned,
  );
  bracket.rotation.z = Math.PI / 2;
  bracket.position.set(0.72, 0.74, 0);
  // On the face that looks a little right of the eye.
  const valve = new Mesh(
    bin.g(new CylinderGeometry(0.045, 0.045, 0.07, 14)),
    brassy,
  );
  valve.position.set(0.215, -0.52, 0.52);
  valve.rotation.set(Math.PI / 2, 0, -0.39);
  const potShadow = new Mesh(
    bin.g(new CircleGeometry(1.25, 32)),
    bin.m(
      new MeshBasicMaterial({
        map: shadowTexture(bin),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  potShadow.rotation.x = -Math.PI / 2;
  potShadow.position.y = -1.04;
  potShadow.scale.set(1, 0.9, 1);
  pot.add(
    potShadow,
    boiler,
    collar,
    bead,
    jug,
    lid,
    stud,
    knob,
    handle,
    bracket,
    valve,
  );
  pot.visible = false;
  root.add(pot);

  /* Steam off the pot once it has settled: a few slow wisps. */
  const wispMap = wispTexture(bin);
  const wisps = Array.from({ length: lite ? 3 : 5 }, (_, i) => {
    const sprite = new Sprite(
      bin.m(
        new SpriteMaterial({
          map: wispMap,
          transparent: true,
          depthWrite: false,
          opacity: 0,
          rotation: i * 1.3,
        }),
      ),
    );
    sprite.visible = false;
    root.add(sprite);
    return sprite;
  });

  /* Grounds thrown by the burst: a fine dark dust, gone as fast. */
  const dot = dotTexture(bin);
  const GROUNDS = lite ? 70 : 180;
  const groundsPlan = Array.from({ length: GROUNDS }, () => {
    const a = rand() * Math.PI * 2;
    const lift = (rand() - 0.5) * 1.6;
    return {
      dir: new Vector3(
        Math.cos(a),
        Math.sin(a) * 0.85 + lift * 0.2,
        lift,
      ).normalize(),
      reach: 0.4 + rand() * 2.6,
      fall: 0.3 + rand() * 1.1,
      delay: rand() * 0.18,
    };
  });
  const groundsGeometry = bin.g(new BufferGeometry());
  groundsGeometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(GROUNDS * 3), 3),
  );
  const groundsMaterial = bin.m(
    new PointsMaterial({
      color: 0x2a1307,
      size: 0.034,
      map: dot,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
  const grounds = new Points(groundsGeometry, groundsMaterial);
  grounds.frustumCulled = false;
  grounds.visible = false;
  root.add(grounds);

  /* Motes in the light: amber dust that drifts up the whole time. */
  const MOTES = lite ? 40 : 110;
  const motesPlan = Array.from({ length: MOTES }, () => ({
    x: (rand() - 0.5) * 10,
    y: (rand() - 0.5) * 5.4,
    z: -4 + rand() * 6.5,
    speed: 0.03 + rand() * 0.08,
    sway: 0.1 + rand() * 0.3,
    phase: rand() * 6.28,
  }));
  const motesGeometry = bin.g(new BufferGeometry());
  motesGeometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(MOTES * 3), 3),
  );
  const motes = new Points(
    motesGeometry,
    bin.m(
      new PointsMaterial({
        color: 0xb5773a,
        size: 0.045,
        map: dot,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      }),
    ),
  );
  motes.frustumCulled = false;
  scene.add(motes);

  /* Far beans in the haze, above and below the words (never behind them:
     the canvas lies over the type). A phone has no room for them. */
  const FAR = lite ? 0 : 12;
  const farKit = FAR ? beanKit(bin, 24, 16).whole : null;
  const farBeans = farKit ? new InstancedMesh(farKit, shell, FAR) : null;
  const farPlan = Array.from({ length: FAR }, (_, i) => {
    const z = -2.5 - rand() * 7;
    const half = Math.tan(MathUtils.degToRad(15)) * (8 - z);
    const band = (i % 2 === 0 ? 1 : -1) * (0.44 + rand() * 0.46);
    return {
      x: (rand() - 0.5) * 2 * half * 1.7,
      y: band * half,
      z,
      size: 0.26 + rand() * 0.2,
      spin: (rand() - 0.5) * 0.5,
      phase: rand() * 6.28,
    };
  });
  if (farBeans) {
    farBeans.frustumCulled = false;
    scene.add(farBeans);
    // The colour of the page: what is far simply goes into it.
    scene.fog = new Fog(0xfaf7f2, 9.6, 18.5);
  }

  /* Where things stand. A phone's hero is a tall slot: the lone bean is
     drawn as large there as on a desk (about a quarter of the screen), the
     pot a little smaller, and the two beans stand half off the edges. */
  let flankX = 1.62;
  let solo = 1;
  let potSize = 0.86;
  const layout = (aspect: number) => {
    const s = MathUtils.clamp(aspect / 1.3, 0.72, 1);
    root.scale.setScalar(s);
    const tall = aspect < 0.8;
    solo = tall ? 1.5 : 1;
    potSize = tall ? 0.8 : 0.86;
    const halfWidth = (Math.tan(MathUtils.degToRad(15)) * 8 * aspect) / s;
    flankX = Math.min(1.62, Math.max(0.9, halfWidth - (tall ? 0.22 : 0.36)));
  };

  const from = new Vector3();
  const to = new Vector3();
  const update = (time: number, p: number) => {
    const open = easeInOut(span(p, 0.16, 0.42));
    const burst = span(p, 0.4, 0.74);
    const split = p >= 0.445;
    const fly = easeOut(span(p, 0.42, 0.78));
    const rise = span(p, 0.52, 0.86);
    const settle = easeInOut(span(p, 0.8, 1));

    /* The bean: leaning, turning slowly, drifting up and left as it opens. */
    bean.visible = !split;
    from.set(0.1, 0.02, 0);
    to.set(-0.3, 0.26, 0);
    bean.position.lerpVectors(from, to, smooth(span(p, 0.08, 0.42)));
    bean.position.y += Math.sin(time * 0.9) * 0.025;
    bean.scale.setScalar(lerp(0.46, 0.58, open) * solo);
    bean.rotation.set(
      -0.18 + Math.sin(time * 0.5) * 0.05,
      0.38 - p * 1.1 + Math.sin(time * 0.6) * 0.12,
      -0.44 + open * 0.14,
    );
    hinges[0].rotation.y = -open * 0.58;
    hinges[1].rotation.y = open * 0.58;
    hinges[0].position.x = -open * 0.07;
    hinges[1].position.x = open * 0.07;

    /* The light: swells through the crack, flashes as the bean lets go. */
    const swell = Math.min(span(p, 0.16, 0.445), 1 - span(p, 0.445, 0.66));
    const glowMaterial = glow.material;
    glowMaterial.opacity = smooth(clamp01(swell * 1.15));
    glow.visible = glowMaterial.opacity > 0.01;
    to.set(-0.04, -0.08, 0);
    glow.position.lerpVectors(bean.position, to, smooth(span(p, 0.42, 0.6)));
    glow.position.z = -0.12;
    glow.scale.setScalar(0.5 + 3.3 * smooth(clamp01(swell)));

    sparks.forEach((spark, i) => {
      const { x, y, size } = spark.userData as {
        x: number;
        y: number;
        size: number;
      };
      const on = smooth(span(p, 0.3, 0.48)) * (1 - 0.6 * settle);
      const blink = 0.72 + 0.28 * Math.sin(time * 2.6 + i * 1.7);
      spark.material.opacity = on * blink;
      spark.visible = on > 0.01;
      spark.position.set(
        glow.position.x + x * (0.6 + fly * 0.9),
        glow.position.y + y * (0.6 + fly * 0.7),
        0.3,
      );
      spark.scale.setScalar(size * (0.7 + 0.5 * blink));
      spark.material.rotation = time * 0.3 + i;
    });

    arcs.forEach((arc, i) => {
      const dir = i === 0 ? 1 : -1;
      arc.position.copy(split ? glow.position : bean.position);
      arc.position.z = 0.1;
      arc.rotation.z = time * 0.35 * dir + p * 3.2 * dir;
      arc.scale.setScalar(0.72 + 0.5 * open + 0.55 * fly);
    });

    /* The burst. */
    const origin = glow.position;
    for (let i = 0; i < DROPS; i++) {
      const d = plan[i];
      const t = clamp01((burst - d.delay) / (1 - d.delay));
      const out = easeOut(t);
      let size = 0;
      if (burst > 0) {
        if (d.keep) {
          // Thrown out, then left hanging about the pot, bobbing.
          size = d.size * 0.9 * smooth(clamp01(t * 4));
          dummy.position
            .copy(d.dir)
            .multiplyScalar(d.reach * 0.62 * out + 0.25)
            .add(origin);
          dummy.position.y += Math.sin(time * 0.8 + d.phase) * 0.05;
          dummy.position.x += Math.cos(time * 0.6 + d.phase) * 0.03;
        } else {
          size = d.size * Math.sin(Math.PI * Math.min(1, t * 1.02));
          dummy.position
            .copy(d.dir)
            .multiplyScalar(d.reach * out)
            .add(origin);
          dummy.position.y -= d.fall * t * t;
        }
      }
      dummy.scale.setScalar(Math.max(size, 0.0001));
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    drops.visible = burst > 0;

    whips.forEach((whip, i) => {
      const local = clamp01(burst * 1.25 - i * 0.05);
      const head = Math.round(easeOut(clamp01(local / 0.62)) * RINGS);
      const tail = Math.round(easeInOut(span(local, 0.34, 1)) * RINGS);
      whip.visible = head > tail;
      whip.position.copy(origin);
      whip.rotation.z = i * 0.4 + burst * 0.5;
      whip.geometry.setDrawRange(tail * SIDES * 6, (head - tail) * SIDES * 6);
    });

    /* The two beans. */
    flanks.forEach((flank, i) => {
      const side = i === 0 ? -1 : 1;
      flank.visible = split;
      from.copy(bean.position);
      from.x += side * 0.14;
      to.set(side * flankX, 0.06 + side * 0.07, 0.25);
      flank.position.lerpVectors(from, to, fly);
      flank.position.y += Math.sin(time * 0.8 + i * 2.1) * 0.05 * fly;
      flank.scale.setScalar(lerp(0.52, 0.47, fly));
      flank.rotation.set(
        -0.2 + Math.sin(time * 0.45 + i) * 0.08,
        side * (0.5 - fly * 0.72) +
          (1 - fly) * side * 3.6 +
          Math.sin(time * 0.5 + i * 1.3) * 0.2,
        side * (0.5 - settle * 0.12),
      );
    });

    /* The pot comes up out of the light. */
    pot.visible = rise > 0;
    const grown = rise > 0 ? easeOutBack(smooth(rise)) : 0;
    pot.scale.setScalar(Math.max(0.001, potSize * grown));
    pot.position.set(
      -0.04,
      lerp(-0.7, -0.06, easeOut(rise)) + Math.sin(time * 0.7) * 0.02,
      0,
    );
    pot.rotation.set(0.1, -0.5 + rise * 0.3 + Math.sin(time * 0.35) * 0.1, 0);

    /* Steam, once the pot stands. */
    wisps.forEach((wisp, i) => {
      const life = (time * 0.16 + i / wisps.length) % 1;
      const on = settle * Math.sin(Math.PI * life);
      wisp.visible = on > 0.01;
      wisp.material.opacity = on * 0.55;
      const size = (0.5 + life * 0.9) * potSize;
      wisp.scale.set(size * 0.8, size * 1.5, 1);
      wisp.position.set(
        pot.position.x - 0.3 * potSize + Math.sin(time * 0.7 + i * 2.1) * 0.08,
        pot.position.y + (1.0 + life * 1.2) * potSize,
        0.2,
      );
    });

    /* The grounds. */
    grounds.visible = burst > 0 && burst < 1;
    if (grounds.visible) {
      const at = groundsGeometry.getAttribute("position") as BufferAttribute;
      for (let i = 0; i < GROUNDS; i++) {
        const d = groundsPlan[i];
        const t = clamp01((burst - d.delay) / (1 - d.delay));
        const out = easeOut(t) * d.reach;
        at.setXYZ(
          i,
          origin.x + d.dir.x * out,
          origin.y + d.dir.y * out - d.fall * t * t,
          origin.z + d.dir.z * out,
        );
      }
      at.needsUpdate = true;
      groundsMaterial.opacity =
        0.85 * Math.sin(Math.PI * Math.min(1, burst * 1.05));
    }

    /* The motes: up, with a sway, and round again. */
    {
      const at = motesGeometry.getAttribute("position") as BufferAttribute;
      for (let i = 0; i < MOTES; i++) {
        const m = motesPlan[i];
        const y = ((m.y + time * m.speed + 2.7) % 5.4) - 2.7;
        at.setXYZ(i, m.x + Math.sin(time * 0.3 + m.phase) * m.sway, y, m.z);
      }
      at.needsUpdate = true;
    }

    /* The far beans turn slowly and rise a little with the scroll. */
    if (farBeans) {
      for (let i = 0; i < FAR; i++) {
        const f = farPlan[i];
        dummy.position.set(
          f.x + Math.sin(time * 0.12 + f.phase) * 0.3,
          f.y +
            Math.sin(time * 0.2 + f.phase) * 0.14 +
            p * 0.5 * Math.sign(f.y),
          f.z,
        );
        dummy.rotation.set(
          time * f.spin + f.phase,
          time * f.spin * 0.7,
          f.phase,
        );
        dummy.scale.setScalar(f.size);
        dummy.updateMatrix();
        farBeans.setMatrixAt(i, dummy.matrix);
      }
      farBeans.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    camera,
    layout,
    update,
    rest: { time: 1.4, progress: 1 },
    lean: [0.34, 0.2],
    reach: 3.4,
  };
}

/* ───────────── pour: a portafilter over a fluted cup ───────────── */

function drawPour(scene: Scene, bin: Bin, lite: boolean): Drawing {
  const camera = new PerspectiveCamera(22, 9 / 16, 0.1, 60);
  camera.position.set(0, 0, 14);
  const root = new Group();
  scene.add(root);

  const brass = bin.m(
    new MeshStandardMaterial({
      color: 0xb98a4a,
      metalness: 1,
      roughness: 0.28,
      envMapIntensity: 1.2,
    }),
  );
  const wood = bin.m(
    new MeshPhysicalMaterial({
      color: 0x4a2916,
      roughness: 0.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
    }),
  );

  /* The portafilter, handle to the right. */
  const filter = new Group();
  const basket = new Mesh(
    bin.g(new CylinderGeometry(0.62, 0.56, 0.36, 48)),
    brass,
  );
  const rim = new Mesh(bin.g(new TorusGeometry(0.63, 0.045, 12, 48)), brass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.18;
  const block = new Mesh(
    bin.g(new CylinderGeometry(0.2, 0.14, 0.16, 24)),
    brass,
  );
  block.position.y = -0.26;
  const spoutGeometry = bin.g(new CylinderGeometry(0.05, 0.04, 0.14, 16));
  const spouts = [-0.09, 0.09].map((x) => {
    const spout = new Mesh(spoutGeometry, brass);
    spout.position.set(x, -0.4, 0);
    return spout;
  });
  const neck = new Mesh(
    bin.g(new CylinderGeometry(0.075, 0.075, 0.3, 16)),
    brass,
  );
  neck.rotation.z = Math.PI / 2;
  neck.position.set(0.74, 0, 0);
  const ferrule = new Mesh(
    bin.g(new CylinderGeometry(0.125, 0.125, 0.14, 20)),
    brass,
  );
  ferrule.rotation.z = Math.PI / 2;
  ferrule.position.set(0.94, 0, 0);
  const grip = new Mesh(
    bin.g(new CylinderGeometry(0.115, 0.09, 1.15, 20)),
    wood,
  );
  grip.rotation.z = -Math.PI / 2;
  grip.position.set(1.58, 0, 0);
  const cap = new Mesh(bin.g(new SphereGeometry(0.115, 16, 12)), wood);
  cap.position.set(2.15, 0, 0);
  filter.add(basket, rim, block, ...spouts, neck, ferrule, grip, cap);
  filter.scale.setScalar(0.66);
  filter.position.set(-0.12, 2.08, 0);
  filter.rotation.set(0.32, -0.22, -0.05);
  root.add(filter);

  /* The stream: thin at the spout, a wide twisting ribbon by the cup. */
  const RINGS = lite ? 56 : 96;
  const SIDES = lite ? 10 : 16;
  const anchors = [
    [-0.12, 1.78],
    [-0.1, 1.3],
    [0.3, 0.72],
    [0.22, 0.12],
    [-0.38, -0.42],
    [-0.3, -0.98],
    [-0.1, -1.36],
  ];
  const points = anchors.map(([x, y]) => new Vector3(x, y, 0));
  const path = new CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const width = (u: number) =>
    0.03 + 0.2 * smooth(span(u, 0.04, 0.5)) - 0.07 * span(u, 0.72, 1);
  const turn = (time: number) => (u: number) => u * 2.4 + time * 0.35;
  const caramel = liquid(bin, 0xffffff, true);
  const stream = new Mesh(
    ribbon(bin, path, RINGS, SIDES, width, 0.42, turn(0)),
    caramel,
  );
  stream.geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array((RINGS + 1) * (SIDES + 1) * 3), 3),
  );
  stream.frustumCulled = false;
  root.add(stream);
  const dark = new Color(0x3a1c0b);
  const pale = new Color(0xb06a2c);
  const tint = new Color();

  /* A few drops let go from the spouts. */
  const DRIPS = 5;
  const drips = new InstancedMesh(
    bin.g(new IcosahedronGeometry(1, 2)),
    liquid(bin, 0x3a1c0c),
    DRIPS,
  );
  drips.frustumCulled = false;
  root.add(drips);
  const dummy = new Object3D();

  /* The cup: fluted clay, crema inside, a saucer under it. */
  const cup = new Group();
  const clay = ceramic(bin, 0xb4532a, 0.3);
  const body = new Mesh(
    flutedLathe(
      bin,
      [
        [0.3, 0],
        [0.33, 0.04],
        [0.37, 0.1],
        [0.53, 0.22],
        [0.72, 0.42],
        [0.84, 0.62],
        [0.88, 0.74],
        [0.84, 0.75],
        [0.8, 0.62],
        [0.68, 0.44],
        [0.45, 0.26],
        [0, 0.2],
      ],
      lite ? 96 : 144,
      36,
      0.032,
      (i) => i >= 2 && i <= 5,
    ),
    clay,
  );
  const crema = new Mesh(
    bin.g(new CircleGeometry(0.805, 48)),
    bin.m(
      new MeshPhysicalMaterial({
        map: cremaTexture(bin),
        roughness: 0.35,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
      }),
    ),
  );
  crema.rotation.x = -Math.PI / 2;
  crema.position.y = 0.63;
  const ear = new Mesh(
    bin.g(new TorusGeometry(0.2, 0.05, 12, 28, Math.PI * 1.25)),
    clay,
  );
  ear.position.set(0.9, 0.42, 0);
  ear.rotation.z = -Math.PI * 0.62;
  const saucer = new Mesh(
    lathe(
      bin,
      [
        [0, 0.02],
        [0.45, 0.02],
        [0.95, 0.07],
        [1.2, 0.15],
        [1.22, 0.18],
        [1.17, 0.19],
        [0.9, 0.12],
        [0.4, 0.07],
        [0, 0.07],
      ],
      72,
    ),
    clay,
  );
  saucer.position.y = -0.1;
  const shadow = new Mesh(
    bin.g(new CircleGeometry(1.5, 32)),
    bin.m(
      new MeshBasicMaterial({
        map: shadowTexture(bin),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.11;
  cup.add(shadow, saucer, body, crema, ear);
  // Sized to sit whole inside the 9:16 box, saucer and its shadow included.
  cup.scale.setScalar(0.86);
  cup.position.set(-0.02, -1.98, 0);
  // Tipped toward the eye, as a camera looking down into it would see it.
  cup.rotation.set(0.5, -0.35, 0);
  root.add(cup);

  const update = (time: number) => {
    anchors.forEach(([x, y], i) => {
      const sway = (i / (anchors.length - 1)) * 0.06;
      points[i].set(
        x + Math.sin(time * 0.9 + i * 1.3) * sway,
        y,
        Math.cos(time * 0.7 + i * 1.1) * sway * 0.8,
      );
    });
    shapeRibbon(stream.geometry, path, RINGS, SIDES, width, 0.42, turn(time));
    const colour = stream.geometry.getAttribute("color") as BufferAttribute;
    for (let i = 0; i <= RINGS; i++) {
      const u = i / RINGS;
      for (let j = 0; j <= SIDES; j++) {
        // Bands of caramel travelling down the pour.
        const band =
          0.5 + 0.5 * Math.sin(u * 15 - time * 4.2 + (j / SIDES) * Math.PI * 2);
        tint.copy(dark).lerp(pale, 0.2 + 0.55 * band * smooth(span(u, 0, 0.3)));
        colour.setXYZ(i * (SIDES + 1) + j, tint.r, tint.g, tint.b);
      }
    }
    colour.needsUpdate = true;

    for (let i = 0; i < DRIPS; i++) {
      const t = (time * 0.55 + i * 0.37) % 1;
      const x = (i % 2 === 0 ? -0.2 : -0.05) + Math.sin(i * 2.4) * 0.04;
      dummy.position.set(x, 1.74 - t * t * 3.3, 0.02);
      const size = 0.028 * Math.sin(Math.PI * Math.min(1, t * 1.6));
      dummy.scale.set(size, size * (1.1 + t * 1.4), size);
      dummy.updateMatrix();
      drips.setMatrixAt(i, dummy.matrix);
    }
    drips.instanceMatrix.needsUpdate = true;

    crema.rotation.z = time * 0.25;
    cup.position.y = -1.98 + Math.sin(time * 0.6) * 0.012;
    filter.position.y = 2.08 + Math.sin(time * 0.5 + 1) * 0.01;
  };

  return {
    camera,
    layout: () => {},
    update,
    rest: { time: 2.2, progress: 0 },
    lean: [0.28, 0.2],
    reach: 3.9,
  };
}

/* ───────────── affogato: the pitcher over the waffle cup ───────────── */

function drawAffogato(scene: Scene, bin: Bin, lite: boolean): Drawing {
  const camera = new PerspectiveCamera(22, 9 / 16, 0.1, 60);
  camera.position.set(0, 0, 14);
  const root = new Group();
  scene.add(root);

  const espresso = liquid(bin, 0x2d1408);
  const clear = glass(bin);

  /* The pitcher: a small glass, tipped past level, espresso to the lip. */
  const TILT = 2.02;
  const BASE = new Vector3(0.98, 2.2, 0);
  const pitcher = new Group();
  const shell = new Mesh(
    lathe(
      bin,
      [
        [0, 0],
        [0.4, 0],
        [0.47, 0.06],
        [0.5, 0.3],
        [0.51, 0.8],
        [0.48, 0.8],
        [0.47, 0.3],
        [0.44, 0.09],
        [0.38, 0.04],
        [0, 0.04],
      ],
      56,
    ),
    clear,
  );
  shell.renderOrder = 2;
  const loop = new Mesh(
    bin.g(new TorusGeometry(0.2, 0.035, 10, 28, Math.PI * 1.2)),
    clear,
  );
  loop.position.set(0.52, 0.42, 0);
  loop.rotation.z = -Math.PI * 0.6;
  loop.renderOrder = 2;
  // What is left in the glass: a body of espresso cut off level by a plane
  // that stays horizontal however far the glass is tipped.
  const level = new Plane(new Vector3(0, -1, 0), 1.84);
  const inside = bin.m(
    new MeshPhysicalMaterial({
      color: 0x2d1408,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: DoubleSide,
      clippingPlanes: [level],
    }),
  );
  const fill = new Mesh(
    lathe(
      bin,
      [
        [0, 0.045],
        [0.37, 0.045],
        [0.435, 0.1],
        [0.462, 0.3],
        [0.472, 0.79],
        [0, 0.79],
      ],
      48,
    ),
    inside,
  );
  pitcher.add(fill, shell, loop);
  pitcher.position.copy(BASE);
  pitcher.rotation.z = TILT;
  root.add(pitcher);
  // Where the tipped rim is lowest: the pour leaves from here.
  const lip = new Vector3(
    BASE.x - 0.8 * Math.sin(TILT) - 0.5 * Math.cos(TILT),
    BASE.y + 0.8 * Math.cos(TILT) - 0.5 * Math.sin(TILT),
    0,
  );

  /* The pour: espresso and a strand of melted cream wound round each other. */
  const RINGS = lite ? 48 : 80;
  const SIDES = lite ? 8 : 12;
  const spine = [
    [lip.x, lip.y],
    [lip.x - 0.2, lip.y - 0.55],
    [0.3, 0.2],
    [0.0, -0.4],
    [-0.16, -0.9],
    [-0.06, -1.22],
  ];
  const strand = (offset: number) => {
    const points = spine.map(([x, y]) => new Vector3(x, y, 0));
    return {
      points,
      curve: new CatmullRomCurve3(points, false, "catmullrom", 0.5),
      offset,
    };
  };
  const strands = [strand(0), strand(Math.PI)];
  const cream = liquid(bin, 0xf1e2c4);
  const pours = strands.map((s, i) => {
    const mesh = new Mesh(
      ribbon(bin, s.curve, RINGS, SIDES, i === 0 ? thick : thin),
      i === 0 ? espresso : cream,
    );
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  });
  function thick(u: number) {
    return 0.05 - 0.018 * u + 0.012 * Math.sin(u * 9);
  }
  function thin(u: number) {
    return 0.028 - 0.006 * u + 0.008 * Math.sin(u * 11 + 2);
  }

  /* Drops thrown off the pour. */
  const rand = seeded(41);
  const DROPS = lite ? 14 : 26;
  const drops = new InstancedMesh(
    bin.g(new IcosahedronGeometry(1, 2)),
    espresso,
    DROPS,
  );
  drops.frustumCulled = false;
  root.add(drops);
  const plan = Array.from({ length: DROPS }, () => ({
    at: rand(),
    side: (rand() - 0.5) * 1.5,
    depth: (rand() - 0.5) * 0.5,
    size: 0.016 + Math.pow(rand(), 2) * 0.05,
    speed: 0.1 + rand() * 0.16,
  }));
  const guide = new CatmullRomCurve3(
    spine.map(([x, y]) => new Vector3(x, y, 0)),
    false,
    "catmullrom",
    0.5,
  );
  const dummy = new Object3D();
  const here = new Vector3();

  /* The cup you eat: waffle, a scoop of fior di latte, espresso over it. */
  const cup = new Group();
  const waffle = waffleTextures(bin);
  const wafer = new Mesh(
    lathe(
      bin,
      [
        [0, 0],
        [0.36, 0],
        [0.4, 0.04],
        [0.5, 0.4],
        [0.62, 0.78],
        [0.64, 0.82],
        [0.6, 0.82],
        [0.57, 0.76],
        [0.46, 0.4],
        [0.36, 0.08],
        [0, 0.06],
      ],
      72,
    ),
    bin.m(
      new MeshPhysicalMaterial({
        map: waffle.map,
        bumpMap: waffle.bump,
        bumpScale: 2.4,
        roughness: 0.62,
        clearcoat: 0.12,
        clearcoatRoughness: 0.6,
      }),
    ),
  );
  // The scoop: a ball worked by the spoon, with a ruffled skirt.
  const scoopGeometry = bin.g(
    new SphereGeometry(0.53, lite ? 40 : 64, lite ? 28 : 44),
  );
  {
    const position = scoopGeometry.getAttribute("position") as BufferAttribute;
    for (let k = 0; k < position.count; k++) {
      here.fromBufferAttribute(position, k);
      const r = here.length();
      const a = Math.atan2(here.z, here.x);
      const down = clamp01(-here.y / r);
      const ridges =
        0.022 * Math.sin(a * 7 + here.y * 9) * Math.sin(here.y * 13 + a * 2);
      const skirt = down * down * 0.07 * (1 + 0.6 * Math.sin(a * 11));
      here.multiplyScalar(1 + ridges + skirt);
      position.setXYZ(k, here.x, here.y, here.z);
    }
    scoopGeometry.computeVertexNormals();
  }
  const scoop = new Mesh(
    scoopGeometry,
    bin.m(
      new MeshPhysicalMaterial({
        color: 0xf5ead4,
        roughness: 0.82,
        sheen: 0.6,
        sheenRoughness: 0.6,
        sheenColor: new Color(0xfff3dc),
      }),
    ),
  );
  scoop.position.y = 0.98;
  // The espresso lying over the scoop: a cap whose edge runs down in fingers.
  const AROUND = lite ? 40 : 64;
  const DOWN = 18;
  const drape = bin.g(new BufferGeometry());
  {
    const cols = AROUND + 1;
    const position = new Float32Array((DOWN + 1) * cols * 3);
    const fingers = Array.from({ length: 7 }, () => ({
      at: rand() * Math.PI * 2,
      wide: 0.16 + rand() * 0.2,
      long: 0.45 + rand() * 0.55,
    }));
    for (let i = 0; i <= DOWN; i++) {
      const v = i / DOWN;
      for (let j = 0; j <= AROUND; j++) {
        const a = (j / AROUND) * Math.PI * 2;
        let reach = 0;
        for (const f of fingers) {
          const d = Math.atan2(Math.sin(a - f.at), Math.cos(a - f.at));
          reach = Math.max(reach, f.long * Math.exp(-Math.pow(d / f.wide, 2)));
        }
        const theta = v * (0.34 + 0.34 * reach) * Math.PI;
        const r = 0.575 + 0.022 * Math.sin(v * Math.PI);
        const k = (i * cols + j) * 3;
        position[k] = Math.sin(theta) * Math.cos(a) * r;
        position[k + 1] = Math.cos(theta) * r;
        position[k + 2] = Math.sin(theta) * Math.sin(a) * r;
      }
    }
    const index: number[] = [];
    for (let i = 0; i < DOWN; i++) {
      for (let j = 0; j < AROUND; j++) {
        const a = i * cols + j;
        const b = a + cols;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    drape.setAttribute("position", new BufferAttribute(position, 3));
    drape.setIndex(index);
    drape.computeVertexNormals();
    weldSeam(drape, DOWN + 1, cols);
  }
  const sauce = new Mesh(drape, espresso);
  sauce.position.copy(scoop.position);
  const plate = new Mesh(
    lathe(
      bin,
      [
        [0, 0.02],
        [0.5, 0.02],
        [0.92, 0.06],
        [1.02, 0.1],
        [1.0, 0.12],
        [0.5, 0.06],
        [0, 0.06],
      ],
      64,
    ),
    ceramic(bin, 0x2a2523, 0.5),
  );
  plate.position.y = -0.07;
  const shadow = new Mesh(
    bin.g(new CircleGeometry(1.4, 32)),
    bin.m(
      new MeshBasicMaterial({
        map: shadowTexture(bin),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.08;
  cup.add(shadow, plate, wafer, scoop, sauce);
  cup.position.set(-0.06, -2.5, 0);
  cup.rotation.set(0.42, 0.3, 0);
  root.add(cup);

  const update = (time: number) => {
    strands.forEach((s, i) => {
      spine.forEach(([x, y], k) => {
        // Wound round the spine, tightest where the pour leaves and lands.
        const u = k / (spine.length - 1);
        const wind = 0.085 * Math.sin(Math.PI * u);
        const a = u * 7.5 - time * 2.1 + s.offset;
        s.points[k].set(
          x + Math.cos(a) * wind + Math.sin(time * 0.8 + k) * 0.015,
          y,
          Math.sin(a) * wind,
        );
      });
      shapeRibbon(
        pours[i].geometry,
        s.curve,
        RINGS,
        SIDES,
        i === 0 ? thick : thin,
      );
    });

    for (let i = 0; i < DROPS; i++) {
      const d = plan[i];
      const u = (d.at + time * d.speed) % 1;
      guide.getPointAt(u, here);
      const out = Math.sin(Math.PI * u);
      dummy.position.set(
        here.x + d.side * out * 0.7,
        here.y - out * 0.1,
        here.z + d.depth * out,
      );
      dummy.scale.setScalar(d.size * Math.sin(Math.PI * Math.min(1, u * 1.15)));
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;

    pitcher.position.y = BASE.y + Math.sin(time * 0.55) * 0.012;
    pitcher.rotation.z = TILT + Math.sin(time * 0.4) * 0.012;
    cup.rotation.y = 0.3 + Math.sin(time * 0.3) * 0.12;
    cup.position.y = -2.5 + Math.sin(time * 0.6 + 1.2) * 0.012;
  };

  return {
    camera,
    layout: () => {},
    update,
    rest: { time: 1.6, progress: 0 },
    lean: [0.28, 0.2],
    reach: 3.9,
  };
}

/* ───────────── the studio ───────────── */

/**
 * The light every surface reflects: a photographer's studio made of plain
 * geometry and baked once into a small cube. A dome that is bright overhead
 * and dark underfoot (so a curved thing shades from top to bottom), a large
 * softbox above, a long key strip at the upper left, a cooler rim strip
 * behind on the right, a low fill card, and a black flag that gives metal
 * and glass a dark edge to be read against. The values are above 1: the
 * bake is in half floats, and a softbox is brighter than paper.
 */
function studioLight(renderer: WebGLRenderer, bin: Bin): Texture {
  const room = new Scene();
  const spent: Array<{ dispose: () => void }> = [];
  const card = (
    width: number,
    height: number,
    [r, g, b]: [number, number, number],
    at: [number, number, number],
  ) => {
    const geometry = new PlaneGeometry(width, height);
    const material = new MeshBasicMaterial({
      side: DoubleSide,
      toneMapped: false,
    });
    material.color.setRGB(r, g, b);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...at);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
    spent.push(geometry, material);
  };

  const dome = new SphereGeometry(30, 32, 16);
  const position = dome.getAttribute("position") as BufferAttribute;
  const shade = new Float32Array(position.count * 3);
  for (let k = 0; k < position.count; k++) {
    const t = smooth(clamp01((position.getY(k) / 30 + 1) / 2));
    shade[k * 3] = lerp(0.34, 1.5, t);
    shade[k * 3 + 1] = lerp(0.3, 1.44, t);
    shade[k * 3 + 2] = lerp(0.26, 1.34, t);
  }
  dome.setAttribute("color", new BufferAttribute(shade, 3));
  const walls = new MeshBasicMaterial({
    side: BackSide,
    vertexColors: true,
    toneMapped: false,
  });
  room.add(new Mesh(dome, walls));
  spent.push(dome, walls);

  card(15, 15, [6.6, 6.4, 6], [0, 13, 2]);
  card(5, 13, [10.5, 10, 9.1], [-12, 5, 8]);
  card(3, 12, [5.6, 5.8, 6.4], [13, 3, -8]);
  card(9, 6, [1.5, 1.4, 1.3], [7, -2, 13]);
  card(8, 14, [0.02, 0.02, 0.02], [12, 0, 7]);

  const baker = new PMREMGenerator(renderer);
  const texture = bin.t(baker.fromScene(room, 0.035).texture);
  baker.dispose();
  for (const thing of spent) thing.dispose();
  return texture;
}

/* ───────────── the stage they all run on ───────────── */

export function startRoast(options: RoastOptions): RoastHandle {
  const { canvas, context, kind, lite, still } = options;

  const renderer = new WebGLRenderer({
    canvas,
    context: context as unknown as WebGLRenderingContext,
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  // The neutral curve keeps a pigment the colour it was given; the filmic
  // one bleached the roast to caramel under the studio's light.
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  // The pitcher's espresso is cut level by a plane of its own.
  renderer.localClippingEnabled = kind === "affogato";

  const scene = new Scene();
  const bin = new Bin();

  scene.environment = studioLight(renderer, bin);
  scene.environmentIntensity = 0.82;
  // One warm key from the upper left for form; on a desktop it also casts.
  const shadows = !lite;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const key = new DirectionalLight(0xfff1dc, 2.2);
  key.position.set(-4.2, 6, 6.4);
  key.castShadow = shadows;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.035;
  const fill = new DirectionalLight(0xffe2c2, 0.45);
  fill.position.set(4, -1, 3);
  scene.add(key, fill);

  const drawing =
    kind === "bean"
      ? drawBean(scene, bin, lite)
      : kind === "pour"
        ? drawPour(scene, bin, lite)
        : drawAffogato(scene, bin, lite);
  const { camera } = drawing;
  const eye = camera.position.clone();

  if (shadows) {
    const lens = key.shadow.camera;
    lens.left = lens.bottom = -drawing.reach;
    lens.right = lens.top = drawing.reach;
    lens.near = 0.5;
    lens.far = 26;
    lens.updateProjectionMatrix();
    // Everything solid casts and receives; light, glass and the painted
    // blobs under the cups do neither.
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as Material & {
        isMeshBasicMaterial?: boolean;
      };
      const solid = !material.isMeshBasicMaterial && !material.transparent;
      mesh.castShadow = solid;
      mesh.receiveShadow = solid;
    });
  }

  // The camera leans toward the pointer: near and far slide past each other.
  const pointer = { x: 0, y: 0, toX: 0, toY: 0 };
  const follows = !still && !lite;
  const onPointer = (event: PointerEvent) => {
    pointer.toX = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.toY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (follows) {
    window.addEventListener("pointermove", onPointer, { passive: true });
  }

  let disposed = false;
  let lost = false;
  let ready = false;
  let visible = true;
  let paused = false;
  let progress = still ? drawing.rest.progress : 0;
  let time = drawing.rest.time;
  let last = 0;
  let frame = 0;
  let pending = false;

  const fit = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      lite ? 1.25 : MAX_PIXEL_RATIO,
      Math.sqrt(MAX_PIXELS / (width * height)),
    );
    renderer.setPixelRatio(Math.max(0.6, ratio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    drawing.layout(camera.aspect);
  };

  const draw = () => {
    if (follows) {
      pointer.x += (pointer.toX - pointer.x) * 0.05;
      pointer.y += (pointer.toY - pointer.y) * 0.05;
      camera.position.set(
        eye.x + pointer.x * drawing.lean[0],
        eye.y - pointer.y * drawing.lean[1],
        eye.z,
      );
      camera.lookAt(0, 0, 0);
    }
    drawing.update(time, progress);
    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady();
    }
  };

  const running = () => {
    const on =
      !disposed && !lost && !still && visible && !paused && !document.hidden;
    return on;
  };

  const tick = (now: number) => {
    frame = 0;
    if (disposed || lost) return;
    const live = running();
    if (live) {
      time += Math.min(0.05, (now - last) / 1000);
      last = now;
    }
    if (live || pending) {
      pending = false;
      draw();
    }
    if (live) frame = requestAnimationFrame(tick);
  };

  /** One frame when the clock is held (a scroll while paused, a resize). */
  const request = () => {
    if (disposed || lost) return;
    pending = true;
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  const sync = () => {
    if (running() && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  const seen = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting;
      sync();
    },
    { rootMargin: "10% 0px" },
  );
  seen.observe(canvas);
  const resized = new ResizeObserver(() => {
    fit();
    request();
  });
  resized.observe(canvas);
  const onVisibility = () => sync();
  document.addEventListener("visibilitychange", onVisibility);
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    options.onLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  fit();
  // Shaders are compiled off the main thread where the driver allows it;
  // the first frame is drawn only once they are ready.
  void renderer.compileAsync(scene, camera).then(() => {
    if (disposed || lost) return;
    request();
    sync();
  });

  return {
    setProgress(next) {
      if (still) return;
      const clamped = clamp01(next);
      if (clamped === progress) return;
      progress = clamped;
      // A paused drawing still follows the scroll: that motion is the
      // visitor's own.
      if (!running()) request();
    },
    setPaused(on) {
      paused = on;
      sync();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      seen.disconnect();
      resized.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("pointermove", onPointer);
      bin.empty();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
