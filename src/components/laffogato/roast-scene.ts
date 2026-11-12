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
  LinearFilter,
  LinearMipmapLinearFilter,
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
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SphereGeometry,
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
 * - `bean`     the hero: one roasted bean wakes and parts along its crease;
 *              the espresso it holds wells up, bursts, and drains away as a
 *              moka pot comes up through it between two beans. Driven by
 *              the scroll (`setProgress`).
 * - `pour`     a portafilter's two thin streams falling into a fluted cup.
 * - `affogato` the house's own cup: espresso poured from a small glass
 *              pitcher over fior di latte in the waffle cup you eat
 *              afterwards.
 *
 * The rule they are drawn by (operator, 12 Kas 2026: "yapay zekaymış gibi
 * gözükmesin"): a photograph of things, not an illustration of an idea.
 * Nothing glows, orbits or sparkles, and nothing is in the air that would
 * not be there. What moves is what moves in a bar: liquid. A cup stands
 * still on its saucer, the portafilter hangs in its group head, a stream
 * wavers and a foam drifts; only the hero's bean and pot float, because
 * they are the title's picture. Materials are the real ones (cast
 * aluminium with its grain, chromed steel, bakelite, glazed clay, glass
 * with a dark edge, a satin roast), and no two far beans are one colour.
 *
 * This module is the only one on the site that imports three, and it is
 * only ever reached through `import()` (roast-stage.tsx), so three never
 * enters a first-load bundle (tests/home-roast.test.ts,
 * tests/client-bundle-weight.test.ts).
 *
 * How they are lit. A product photograph's studio is built once per canvas
 * out of plain geometry - a room that is bright overhead, dark underfoot
 * and darker where the camera stands, a softbox, a key strip, a rim strip,
 * a black flag - and baked into the environment every material reflects:
 * it is what gives the aluminium its facets, the espresso its long
 * highlights and the glaze its shape. One warm key light adds form and, on
 * a desktop, real soft shadows (a stream on the crema, the scoop on the
 * wafer, the handle on the pot). Depth is drawn, not post-processed: a haze
 * the colour of the page takes the far beans, and the camera leans a
 * little toward the pointer so near and far slide past each other.
 *
 * A drawing never runs unseen: the loop holds while the canvas is off
 * screen, the tab is hidden, or the visitor has paused it (WCAG 2.2.2);
 * under prefers-reduced-motion it is one still frame. A phone (`lite`) gets
 * the same picture with fewer segments and drops, a lower pixel ratio, no
 * shadow pass and no pointer.
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

/**
 * Cast and brushed metal is never a mirror: a fine, even grain breaks a
 * highlight up along a face. Soft noise, turned into a normal map.
 */
function grainTexture(bin: Bin) {
  const size = 128;
  const rand = seeded(7);
  const field = new Float32Array(size * size);
  for (let i = 0; i < field.length; i++) field[i] = rand();
  const at = (x: number, y: number) =>
    field[((y + size) % size) * size + ((x + size) % size)];
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const len = Math.hypot(dx, dy, 1);
      const k = (y * size + x) * 4;
      data[k] = (-dx / len) * 127.5 + 127.5;
      data[k + 1] = (-dy / len) * 127.5 + 127.5;
      data[k + 2] = (1 / len) * 127.5 + 127.5;
      data[k + 3] = 255;
    }
  }
  return smoothData(bin.t(new DataTexture(data, size, size, RGBAFormat)), 5);
}

/** A data texture that tiles and is filtered like a photograph, not a grid. */
function smoothData(texture: DataTexture, repeat: number) {
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
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
  const map = (data: Uint8Array) =>
    smoothData(bin.t(new DataTexture(data, size, size, RGBAFormat)), 1);
  return { normalMap: map(normal), roughnessMap: map(rough) };
}

/**
 * Crema: the hazel foam on an espresso. Darker toward the rim, marbled
 * with pale and dark blooms dragged a little round the cup, pricked with
 * bubbles.
 */
function cremaTexture(bin: Bin) {
  const rand = seeded(5);
  return paint(bin, 256, true, (g, s) => {
    const c = s / 2;
    const fade = g.createRadialGradient(c, c, 0, c, c, c);
    fade.addColorStop(0, "#ad7742");
    fade.addColorStop(0.65, "#8b582b");
    fade.addColorStop(1, "#553018");
    g.fillStyle = fade;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) {
      const r = rand() * (c - 10);
      const a = rand() * Math.PI * 2;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      const size = 8 + rand() * 30;
      const tone = rand() < 0.6 ? "214,170,116" : "70,36,16";
      const bloom = g.createRadialGradient(x, y, 0, x, y, size);
      bloom.addColorStop(0, `rgba(${tone},${0.1 + rand() * 0.2})`);
      bloom.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = bloom;
      g.save();
      // Drawn out along the turn of the cup, not toward its middle.
      g.translate(x, y);
      g.rotate(a + Math.PI / 2);
      g.scale(1.9, 0.7);
      g.translate(-x, -y);
      g.fillRect(x - size, y - size, size * 2, size * 2);
      g.restore();
    }
    for (let i = 0; i < 60; i++) {
      const r = rand() * (c - 14);
      const a = rand() * Math.PI * 2;
      g.fillStyle = `rgba(60,30,14,${0.12 + rand() * 0.22})`;
      g.beginPath();
      g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 0.6 + rand() * 1.6, 0, 7);
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
  const map = paint(bin, 256, true, lattice("#c08440", "#874f21"));
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

/** Glazed clay: the glaze is a coat of glass over the body's colour. */
function ceramic(bin: Bin, colour: number, roughness = 0.3) {
  return bin.m(
    new MeshPhysicalMaterial({
      color: colour,
      roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.1,
    }),
  );
}

/**
 * The same clay left satin. A flat plate glazed like the cup goes grey
 * under a softbox: what stands under the cup is stoneware.
 */
function stoneware(bin: Bin, colour: number) {
  return bin.m(
    new MeshPhysicalMaterial({
      color: colour,
      roughness: 0.5,
      clearcoat: 0.3,
      clearcoatRoughness: 0.45,
    }),
  );
}

/** Polished steel, with the grain a lathe leaves on it. */
function steel(bin: Bin, grain: Texture, roughness = 0.2) {
  return bin.m(
    new MeshPhysicalMaterial({
      color: 0xd4d3d0,
      metalness: 1,
      roughness,
      normalMap: grain,
      normalScale: new Vector2(0.07, 0.07),
      envMapIntensity: 1.25,
    }),
  );
}

/** Bakelite, or the black handle of anything that gets hot. */
function bakelite(bin: Bin) {
  return bin.m(
    new MeshPhysicalMaterial({
      color: 0x17110e,
      roughness: 0.36,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
    }),
  );
}

/**
 * Glass, lit the way glass is photographed on a pale ground ("bright
 * field"): the body is clear, the wall where it turns away from the eye is
 * a dark line, and a lamp shows as a small white highlight. Real
 * transmission samples what is drawn behind the glass, and behind this
 * canvas is the page itself, which the scene cannot see; so the shell has
 * no colour of its own, only an edge and its reflections.
 */
function glass(bin: Bin) {
  const material = bin.m(
    new MeshPhysicalMaterial({
      // No body colour: what is left of the lighting is the reflection.
      color: 0x000000,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 1,
      envMapIntensity: 0.5,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float facing = abs(dot(normalize(vViewPosition), normal));
      float edge = 1.0 - smoothstep(0.0, 0.42, facing);
      float lamp = smoothstep(1.1, 2.6, dot(outgoingLight, vec3(0.3333)))
        * smoothstep(0.12, 0.45, facing);
      outgoingLight = mix(vec3(0.16, 0.13, 0.11), vec3(1.0), lamp);
      diffuseColor.a = clamp(0.006 + edge * 0.7 + lamp * 0.9, 0.0, 0.94);
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

/**
 * A body of liquid with nothing to hold it: nearly a ball, never quite. The
 * swell is a function of place, so the seam of the sphere stays closed.
 */
function gobbet(bin: Bin, around: number, down: number) {
  const geometry = bin.g(new SphereGeometry(1, around, down));
  const position = geometry.getAttribute("position") as BufferAttribute;
  for (let k = 0; k < position.count; k++) {
    POINT.fromBufferAttribute(position, k);
    const swell =
      1 +
      0.1 * Math.sin(POINT.x * 3.1 + 1.3) * Math.sin(POINT.y * 2.7 + 0.4) +
      0.07 * Math.sin(POINT.z * 4.1 + POINT.x * 2.2);
    position.setXYZ(k, POINT.x * swell, POINT.y * swell, POINT.z * swell);
  }
  geometry.computeVertexNormals();
  weldSeam(geometry, down + 1, around + 1);
  return geometry;
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
  const roast = new Color(0x4b2611);
  const shade = new Color(0x170a05);
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
      roughness: skin ? 1 : 0.55,
      roughnessMap: skin?.roughnessMap ?? null,
      normalMap: skin?.normalMap ?? null,
      normalScale: new Vector2(0.85, 0.85),
      // A thin, uneven film: a roasted bean is satin, not lacquered.
      clearcoat: 0.22,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.9,
    }),
  );
}

/* ───────────── a drawing ───────────── */

interface Drawing {
  camera: PerspectiveCamera;
  /**
   * Places things for the canvas: its shape, and its width in CSS pixels
   * (the hero's words change layout at a width, not at a shape).
   */
  layout: (aspect: number, width: number) => void;
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
  const espresso = liquid(bin, 0x2a1307);
  // The inside of the shell, seen once the bean opens: wet with espresso.
  const lining = bin.m(
    new MeshPhysicalMaterial({
      color: 0x1f0e06,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      side: BackSide,
    }),
  );
  const gob = gobbet(bin, lite ? 28 : 40, lite ? 20 : 28);

  /* The bean, as two halves hinged along its back, and what it holds. */
  const bean = new Group();
  const hinges = kit.halves.map((geometry) => {
    const hinge = new Group();
    hinge.position.z = -0.42;
    const half = new Group();
    half.position.z = 0.42;
    half.add(new Mesh(geometry, shell), new Mesh(geometry, lining));
    hinge.add(half);
    bean.add(hinge);
    return hinge;
  });
  const pith = new Mesh(gob, espresso);
  pith.position.z = -0.06;
  pith.visible = false;
  bean.add(pith);
  root.add(bean);

  /* The two whole beans it becomes. */
  const flanks = [-1, 1].map(() => {
    const mesh = new Mesh(kit.whole, shell);
    mesh.visible = false;
    root.add(mesh);
    return mesh;
  });

  /* The espresso the bean lets go of: a body that swells out of the shell,
     bursts, and drains away as the pot comes up through it. */
  const core = new Mesh(gob, espresso);
  core.visible = false;
  root.add(core);

  /* The burst: drops thrown outward, drawn out along their flight, falling. */
  const rand = seeded(23);
  const DROPS = lite ? 30 : 64;
  const drops = new InstancedMesh(
    bin.g(new IcosahedronGeometry(1, 2)),
    espresso,
    DROPS,
  );
  drops.frustumCulled = false;
  drops.visible = false;
  root.add(drops);
  const plan = Array.from({ length: DROPS }, () => {
    const a = rand() * Math.PI * 2;
    return {
      dir: new Vector3(
        Math.cos(a),
        Math.sin(a) * 0.85 + 0.22,
        (rand() - 0.5) * 1.1,
      ).normalize(),
      reach: 0.7 + rand() * 2.1,
      // Most of it is a fine spray; a few drops are heavy.
      size: 0.012 + Math.pow(rand(), 3) * 0.08,
      delay: rand() * 0.26,
      fall: 0.7 + rand() * 1.3,
    };
  });
  const dummy = new Object3D();
  const UP = new Vector3(0, 1, 0);

  /* The burst: a crown of short tongues thrown up and out of the espresso,
     thick where they leave it, each beading at its tip before it lets go.
     Most of them rise: what goes down simply drips. */
  const RINGS = lite ? 24 : 36;
  const SIDES = 8;
  const TONGUES = lite ? 6 : 9;
  const whips = Array.from({ length: TONGUES }, (_, i) => {
    const turn = -0.5 + (i / (TONGUES - 1)) * (Math.PI + 1) + rand() * 0.3;
    const bend = (rand() - 0.5) * 0.7;
    const long = 0.18 + rand() * 0.3;
    const depth = (rand() - 0.5) * 0.6;
    const base = 0.075 + rand() * 0.035;
    const points: Vector3[] = [];
    for (let s = 0; s <= 4; s++) {
      const u = s / 4;
      const a = turn + u * bend;
      // From just inside the body's skin outward (the body is 0.54 wide).
      const r = 0.4 + u * long;
      points.push(
        new Vector3(
          Math.cos(a) * r,
          // Thrown, so it is already falling by the time it is long.
          Math.sin(a) * r * 0.9 - u * u * 0.12,
          depth * u,
        ),
      );
    }
    const mesh = new Mesh(
      ribbon(
        bin,
        new CatmullRomCurve3(points),
        RINGS,
        SIDES,
        (u) =>
          base * Math.pow(1 - u, 1.2) +
          0.034 * Math.exp(-Math.pow((u - 0.88) / 0.09, 2)) +
          0.01,
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
  const grain = grainTexture(bin);
  // Cast aluminium: a soft sheen on each face, not a mirror.
  const aluminium = bin.m(
    new MeshPhysicalMaterial({
      color: 0xc6c4c0,
      metalness: 1,
      roughness: 0.36,
      flatShading: true,
      normalMap: grain,
      normalScale: new Vector2(0.06, 0.06),
      envMapIntensity: 1.2,
    }),
  );
  const turned = steel(bin, grain, 0.26);
  const black = bakelite(bin);
  const brassy = bin.m(
    new MeshStandardMaterial({
      color: 0xb8924e,
      metalness: 1,
      roughness: 0.34,
    }),
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
  const knob = new Mesh(bin.g(new SphereGeometry(0.095, 20, 14)), black);
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
    black,
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
  const potShade = bin.m(
    new MeshBasicMaterial({
      map: shadowTexture(bin),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
  const potShadow = new Mesh(bin.g(new CircleGeometry(1.25, 32)), potShade);
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
    // No two beans roast alike: each is a shade of its own.
    const tone = new Color();
    for (let i = 0; i < FAR; i++) {
      const k = 0.8 + rand() * 0.32;
      farBeans.setColorAt(
        i,
        tone.setRGB(k, k * (0.95 + rand() * 0.07), k * 0.96),
      );
    }
    // The colour of the page: what is far simply goes into it.
    scene.fog = new Fog(0xfaf7f2, 9.6, 18.5);
  }

  /* Where things stand. Under 640px the words are stacked (globals.css)
     and the lone bean has the open middle of a tall slot: it is drawn as
     large there as on a desk, the pot a little smaller, and the two beans
     stand half off the edges. From 640px the words stand in one row and
     the bean in the gap between "UYAN" and "KAHVE", so it is drawn at the
     words' size: the stylesheet sets them to min(12.5rem, (50vw - pad) /
     3.68) (`--roast-word`), and at 1920 x 1080 (scale 1) a word is 0.185 of
     the screen's height. Until 12 Kas 2026 the choice was the canvas's
     shape, and a portrait tablet, which has the row, got the phone's large
     bean over its words. */
  let flankX = 1.62;
  let solo = 1;
  let potSize = 0.86;
  const layout = (aspect: number, width: number) => {
    const tall = width < 640;
    let s: number;
    if (tall) {
      s = MathUtils.clamp(aspect / 1.3, 0.72, 1);
    } else {
      const pad = width >= 1024 ? 56 : 32;
      const word = Math.min(200, (width / 2 - pad) / 3.68);
      s = MathUtils.clamp(word / (width / aspect) / 0.185, 0.45, 1);
    }
    root.scale.setScalar(s);
    solo = tall ? 1.5 : 1;
    potSize = tall ? 0.8 : 0.86;
    const halfWidth = (Math.tan(MathUtils.degToRad(15)) * 8 * aspect) / s;
    flankX = Math.min(1.62, Math.max(0.9, halfWidth - (tall ? 0.22 : 0.36)));
  };

  const origin = new Vector3();
  const from = new Vector3();
  const to = new Vector3();
  const flight = new Vector3();
  const update = (time: number, p: number) => {
    const open = easeInOut(span(p, 0.16, 0.42));
    const burst = span(p, 0.44, 0.78);
    const split = p >= 0.445;
    const fly = easeOut(span(p, 0.42, 0.78));
    const rise = span(p, 0.5, 0.86);
    const settle = easeInOut(span(p, 0.8, 1));

    /* The bean: leaning, turning slowly, drifting up and left as it opens. */
    bean.visible = !split;
    from.set(0.1, 0.02, 0);
    to.set(-0.3, 0.26, 0);
    bean.position.lerpVectors(from, to, smooth(span(p, 0.08, 0.42)));
    bean.position.y += Math.sin(time * 0.9) * 0.02;
    bean.scale.setScalar(lerp(0.46, 0.58, open) * solo);
    bean.rotation.set(
      -0.18 + Math.sin(time * 0.5) * 0.04,
      0.38 - p * 1.1 + Math.sin(time * 0.6) * 0.1,
      -0.44 + open * 0.14,
    );
    hinges[0].rotation.y = -open * 0.58;
    hinges[1].rotation.y = open * 0.58;
    hinges[0].position.x = -open * 0.07;
    hinges[1].position.x = open * 0.07;
    // Espresso wells up through the crease as it parts.
    const well = smooth(span(p, 0.2, 0.44));
    pith.visible = well > 0.01;
    pith.scale.set(0.5 * well, 0.84 * well, 0.3 * well);

    /* Where the espresso is let go: it slides to the middle of the stage. */
    to.set(-0.04, -0.08, 0);
    origin.lerpVectors(bean.position, to, smooth(span(p, 0.44, 0.6)));

    /* The body of espresso: out of the shell, wide, then drained away. */
    const freed = easeOut(span(p, 0.445, 0.54));
    const drained = easeInOut(span(p, 0.56, 0.8));
    const girth = split ? lerp(0.26 * solo, 0.54, freed) * (1 - drained) : 0;
    core.visible = girth > 0.004;
    core.position.copy(origin);
    core.position.y -= drained * 0.4;
    core.rotation.set(time * 0.5, time * 0.37, 0);
    core.scale.set(
      girth * (1 + 0.06 * Math.sin(time * 5.1)),
      girth * (0.86 - 0.06 * Math.sin(time * 5.1 + 0.8)),
      girth,
    );

    /* The burst: every drop flies its own arc and is drawn out along it. */
    drops.visible = burst > 0 && burst < 1;
    if (drops.visible) {
      for (let i = 0; i < DROPS; i++) {
        const d = plan[i];
        const t = clamp01((burst - d.delay) / (1 - d.delay));
        dummy.position
          .copy(d.dir)
          .multiplyScalar(d.reach * easeOut(t))
          .add(origin);
        dummy.position.y -= d.fall * t * t;
        flight.copy(d.dir).multiplyScalar(3 * (1 - t) * (1 - t) * d.reach);
        flight.y -= 2 * d.fall * t;
        const speed = flight.length();
        if (speed > 0.0001) {
          dummy.quaternion.setFromUnitVectors(UP, flight.divideScalar(speed));
        }
        // Fast means long and thin; it comes to nothing at either end.
        const stretch = 1 + Math.min(0.9, speed * 0.3);
        const size = d.size * Math.sin(Math.PI * Math.pow(t, 0.75));
        const thin = Math.max(size / Math.sqrt(stretch), 0.0001);
        dummy.scale.set(thin, Math.max(size * stretch, 0.0001), thin);
        dummy.updateMatrix();
        drops.setMatrixAt(i, dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
    }

    // The crown belongs to the body: it grows out of it and goes with it.
    whips.forEach((whip, i) => {
      const local = clamp01(burst * 2.2 - (i % 4) * 0.07);
      const head = Math.round(easeOut(local) * RINGS);
      whip.visible = head > 0 && girth > 0.02;
      whip.position.copy(core.position);
      whip.scale.setScalar(girth / 0.54);
      whip.rotation.z = burst * 0.25;
      whip.geometry.setDrawRange(0, head * SIDES * 6);
    });

    /* The two beans. */
    flanks.forEach((flank, i) => {
      const side = i === 0 ? -1 : 1;
      flank.visible = split;
      from.copy(bean.position);
      from.x += side * 0.14;
      to.set(side * flankX, 0.06 + side * 0.07, 0.25);
      flank.position.lerpVectors(from, to, fly);
      flank.position.y += Math.sin(time * 0.8 + i * 2.1) * 0.04 * fly;
      flank.scale.setScalar(lerp(0.52, 0.47, fly));
      flank.rotation.set(
        -0.2 + Math.sin(time * 0.45 + i) * 0.06,
        side * (0.5 - fly * 0.72) +
          (1 - fly) * side * 3.6 +
          Math.sin(time * 0.5 + i * 1.3) * 0.16,
        side * (0.5 - settle * 0.12),
      );
    });

    /* The pot comes up through the espresso, turning into place. */
    pot.visible = rise > 0;
    const grown = easeOut(rise);
    pot.scale.setScalar(potSize * lerp(0.36, 1, grown));
    pot.position.set(
      -0.04,
      lerp(-0.34, -0.06, grown) + Math.sin(time * 0.7) * 0.015,
      0,
    );
    pot.rotation.set(
      0.1,
      -1.3 + grown * 1.1 + Math.sin(time * 0.35) * 0.08 * settle,
      0,
    );
    potShade.opacity = 0.9 * smooth(span(p, 0.68, 0.9));

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

  const grain = grainTexture(bin);
  const chrome = steel(bin, grain, 0.18);
  const black = bakelite(bin);

  /* The portafilter: chromed, two spouts, a black handle that runs back to
     the right. It hangs where the group head holds it and does not move. */
  const filter = new Group();
  const basket = new Mesh(
    bin.g(new CylinderGeometry(0.62, 0.56, 0.36, 48)),
    chrome,
  );
  const rim = new Mesh(bin.g(new TorusGeometry(0.63, 0.045, 12, 48)), chrome);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.18;
  const block = new Mesh(
    bin.g(new CylinderGeometry(0.2, 0.14, 0.16, 24)),
    chrome,
  );
  block.position.y = -0.26;
  const spoutGeometry = bin.g(new CylinderGeometry(0.05, 0.04, 0.14, 16));
  const spouts = [-0.09, 0.09].map((x) => {
    const spout = new Mesh(spoutGeometry, chrome);
    spout.position.set(x, -0.4, 0);
    return spout;
  });
  const neck = new Mesh(
    bin.g(new CylinderGeometry(0.075, 0.075, 0.3, 16)),
    chrome,
  );
  neck.rotation.z = Math.PI / 2;
  neck.position.set(0.74, 0, 0);
  const ferrule = new Mesh(
    bin.g(new CylinderGeometry(0.125, 0.125, 0.14, 20)),
    chrome,
  );
  ferrule.rotation.z = Math.PI / 2;
  ferrule.position.set(0.94, 0, 0);
  const grip = new Mesh(
    bin.g(new CylinderGeometry(0.115, 0.09, 1.15, 20)),
    black,
  );
  grip.rotation.z = -Math.PI / 2;
  grip.position.set(1.58, 0, 0);
  const cap = new Mesh(bin.g(new SphereGeometry(0.115, 16, 12)), black);
  cap.position.set(2.15, 0, 0);
  filter.add(basket, rim, block, ...spouts, neck, ferrule, grip, cap);
  filter.scale.setScalar(0.9);
  filter.position.set(-0.1, 1.82, 0.38);
  filter.rotation.set(0.3, 0.8, -0.03);
  root.add(filter);

  /* The cup: fluted, glazed the colour of espresso, crema to the rim, on
     its saucer. It stands on the bar: nothing here floats. */
  const cup = new Group();
  const glazed = ceramic(bin, 0x2e1810, 0.24);
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
    glazed,
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
    glazed,
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
    stoneware(bin, 0x2e1810),
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
  // Sized to sit whole inside the 9:16 box, saucer and its shadow included,
  // and tipped toward the eye, as a camera looking down into it sees it.
  cup.position.set(0.02, -1.25, 0);
  cup.rotation.set(0.5, -0.35, 0);
  root.add(cup);

  /* Two streams, one from each spout, as an espresso really falls: thin,
     dark where they leave, tawny where the light comes through them, and
     never quite still. Each is pinned to its spout and to the crema. */
  root.updateMatrixWorld(true);
  const RINGS = lite ? 40 : 64;
  const SIDES = lite ? 8 : 12;
  const gauge = (u: number) => 0.034 - 0.013 * smooth(u);
  const coffee = liquid(bin, 0xffffff, true);
  const streams = spouts.map((spout, n) => {
    const top = spout.localToWorld(new Vector3(0, -0.07, 0));
    const foot = cup.localToWorld(
      new Vector3(n === 0 ? -0.1 : 0.08, 0.63, 0.06),
    );
    const anchors = [0, 0.3, 0.62, 1].map(
      (t) =>
        new Vector3(
          lerp(top.x, foot.x, smooth(t)),
          lerp(top.y, foot.y, t),
          lerp(top.z, foot.z, smooth(t)),
        ),
    );
    const points = anchors.map((anchor) => anchor.clone());
    const path = new CatmullRomCurve3(points, false, "catmullrom", 0.5);
    const mesh = new Mesh(ribbon(bin, path, RINGS, SIDES, gauge), coffee);
    mesh.geometry.setAttribute(
      "color",
      new BufferAttribute(new Float32Array((RINGS + 1) * (SIDES + 1) * 3), 3),
    );
    mesh.frustumCulled = false;
    root.add(mesh);
    return { anchors, points, path, mesh };
  });
  const dark = new Color(0x2a1206);
  const pale = new Color(0xa5672b);
  const tint = new Color();

  const update = (time: number) => {
    streams.forEach((stream, n) => {
      const last = stream.anchors.length - 1;
      stream.anchors.forEach((anchor, i) => {
        // The ends are held; only the middle wavers.
        const free = Math.sin((Math.PI * i) / last);
        stream.points[i].set(
          anchor.x + Math.sin(time * 1.7 + i * 1.3 + n * 2.1) * 0.012 * free,
          anchor.y,
          anchor.z + Math.cos(time * 1.3 + i * 1.1 + n) * 0.01 * free,
        );
      });
      const geometry = stream.mesh.geometry;
      shapeRibbon(geometry, stream.path, RINGS, SIDES, gauge);
      const colour = geometry.getAttribute("color") as BufferAttribute;
      for (let i = 0; i <= RINGS; i++) {
        const u = i / RINGS;
        // Tiger stripes: tawny bands that travel down the stream.
        const band = 0.5 + 0.5 * Math.sin(u * 13 - time * 3.6 + n * 1.9);
        tint
          .copy(dark)
          .lerp(pale, 0.12 + 0.5 * band * smooth(span(u, 0, 0.25)));
        for (let j = 0; j <= SIDES; j++) {
          colour.setXYZ(i * (SIDES + 1) + j, tint.r, tint.g, tint.b);
        }
      }
      colour.needsUpdate = true;
    });
    // The foam drifts; it does not spin.
    crema.rotation.z = time * 0.05;
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

  const espresso = liquid(bin, 0x2a1206);
  const clear = glass(bin);
  const rand = seeded(41);
  const here = new Vector3();

  /* The cup you eat: waffle, a scoop of fior di latte, espresso over it
     and pooled round it. It stands on its plate and does not move. */
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
        roughness: 0.68,
        clearcoat: 0.08,
        clearcoatRoughness: 0.6,
      }),
    ),
  );
  // The scoop: a ball worked by the spoon, lumpy, with a skirt where it
  // has begun to melt.
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
      const lumps =
        0.03 * Math.sin(here.x * 5.3 + 1.1) * Math.sin(here.z * 4.7 + 0.3);
      const skirt = down * down * 0.07 * (1 + 0.6 * Math.sin(a * 11));
      here.multiplyScalar(1 + ridges + lumps + skirt);
      position.setXYZ(k, here.x, here.y, here.z);
    }
    scoopGeometry.computeVertexNormals();
    weldSeam(scoopGeometry, (lite ? 28 : 44) + 1, (lite ? 40 : 64) + 1);
  }
  const scoop = new Mesh(
    scoopGeometry,
    bin.m(
      new MeshPhysicalMaterial({
        color: 0xf4ead9,
        roughness: 0.78,
        sheen: 0.5,
        sheenRoughness: 0.6,
        sheenColor: new Color(0xfff3dc),
      }),
    ),
  );
  scoop.position.y = 0.98;
  // The espresso lying over the scoop: a cap whose edge runs down in
  // fingers, dark where it is deep and milky where it thins into the cream.
  const AROUND = lite ? 40 : 64;
  const DOWN = 18;
  const drape = bin.g(new BufferGeometry());
  {
    const cols = AROUND + 1;
    const position = new Float32Array((DOWN + 1) * cols * 3);
    const colour = new Float32Array((DOWN + 1) * cols * 3);
    const deep = new Color(0x2a1206);
    const milky = new Color(0x8a5a35);
    const tint = new Color();
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
        const theta = v * (0.3 + 0.3 * reach) * Math.PI;
        const r = 0.566 + 0.012 * Math.sin(v * Math.PI);
        const k = (i * cols + j) * 3;
        position[k] = Math.sin(theta) * Math.cos(a) * r;
        position[k + 1] = Math.cos(theta) * r;
        position[k + 2] = Math.sin(theta) * Math.sin(a) * r;
        tint.copy(deep).lerp(milky, smooth(span(v, 0.45, 1)) * 0.85);
        colour.set([tint.r, tint.g, tint.b], k);
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
    drape.setAttribute("color", new BufferAttribute(colour, 3));
    drape.setIndex(index);
    drape.computeVertexNormals();
    weldSeam(drape, DOWN + 1, cols);
  }
  const sauce = new Mesh(drape, liquid(bin, 0xffffff, true));
  sauce.position.copy(scoop.position);
  // What has run down: espresso and melted cream, pooled inside the rim.
  const pool = new Mesh(
    bin.g(new CircleGeometry(0.565, 48)),
    bin.m(
      new MeshPhysicalMaterial({
        map: cremaTexture(bin),
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
      }),
    ),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.745;
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
    stoneware(bin, 0x241d1a),
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
  cup.add(shadow, plate, wafer, pool, scoop, sauce);
  cup.scale.setScalar(0.96);
  cup.position.set(-0.25, -1.65, 0);
  cup.rotation.set(0.42, 0.3, 0);
  root.add(cup);
  root.updateMatrixWorld(true);
  // Where the pour lands: the crown of the scoop.
  const land = scoop.localToWorld(new Vector3(0.04, 0.53, 0.06));

  /* The pitcher: a small glass tipped as a hand tips it, about half of the
     espresso still in it, level with the lip it leaves by. Placed from the
     landing point up, so the pour falls straight. */
  const TILT = 0.95;
  const lip = new Vector3(land.x + 0.26, land.y + 1.55, land.z);
  const BASE = new Vector3(
    lip.x + 0.8 * Math.sin(TILT) + 0.5 * Math.cos(TILT),
    lip.y - 0.8 * Math.cos(TILT) + 0.5 * Math.sin(TILT),
    land.z,
  );
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
  const level = new Plane(new Vector3(0, -1, 0), lip.y + 0.012);
  const inside = bin.m(
    new MeshPhysicalMaterial({
      color: 0x2a1206,
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

  /* The pour: one thin stream. It leaves along the lip, turns over and
     falls straight onto the scoop. */
  const RINGS = lite ? 48 : 80;
  const SIDES = lite ? 8 : 12;
  const anchors = [
    new Vector3(lip.x + 0.02, lip.y + 0.004, lip.z),
    new Vector3(lip.x - 0.1, lip.y - 0.06, lip.z),
    new Vector3(lip.x - 0.21, lip.y - 0.3, lip.z),
    new Vector3(land.x + 0.012, lerp(lip.y, land.y, 0.62), lip.z),
    land.clone(),
  ];
  const points = anchors.map((anchor) => anchor.clone());
  const path = new CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const gauge = (u: number) => 0.04 - 0.019 * smooth(u);
  const pour = new Mesh(ribbon(bin, path, RINGS, SIDES, gauge), espresso);
  pour.frustumCulled = false;
  root.add(pour);

  const update = (time: number) => {
    const last = anchors.length - 1;
    anchors.forEach((anchor, i) => {
      // Held at the lip and where it lands; only the fall wavers.
      const free = Math.sin((Math.PI * i) / last);
      points[i].set(
        anchor.x + Math.sin(time * 1.6 + i * 1.4) * 0.012 * free,
        anchor.y,
        anchor.z + Math.cos(time * 1.2 + i) * 0.01 * free,
      );
    });
    // A pour is never even: a swelling runs down it.
    shapeRibbon(
      pour.geometry,
      path,
      RINGS,
      SIDES,
      (u) => gauge(u) + 0.0028 * Math.sin(u * 16 - time * 7),
    );
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
    // Dark underfoot, a mid-grey wall at eye level, bright only overhead,
    // and darker on the side the camera stands on than behind the set: in
    // an evenly white room polished metal is simply white.
    const x = position.getX(k) / 30;
    const z = position.getZ(k) / 30;
    const t = Math.pow(smooth(clamp01((position.getY(k) / 30 + 1) / 2)), 1.5);
    const behind =
      0.5 - 0.5 * ((x * 0.55 + z * 0.83) / (Math.hypot(x, z) || 1));
    const wall = lerp(1, lerp(0.46, 1.12, behind), Math.hypot(x, z));
    shade[k * 3] = lerp(0.16, 1.4, t) * wall;
    shade[k * 3 + 1] = lerp(0.14, 1.34, t) * wall;
    shade[k * 3 + 2] = lerp(0.12, 1.25, t) * wall;
  }
  dome.setAttribute("color", new BufferAttribute(shade, 3));
  const walls = new MeshBasicMaterial({
    side: BackSide,
    vertexColors: true,
    toneMapped: false,
  });
  room.add(new Mesh(dome, walls));
  spent.push(dome, walls);

  card(10, 10, [8.4, 8.1, 7.6], [0, 13, 2]);
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
    drawing.layout(camera.aspect, width);
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
