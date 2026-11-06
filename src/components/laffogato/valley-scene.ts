import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CustomBlending,
  Mesh,
  NormalBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";

import {
  DUST_FRAGMENT,
  DUST_VERTEX,
  FIELD_FRAGMENT,
  FIELD_VERTEX,
  QUAD_VERTEX,
  SKY_FRAGMENT,
  SOLID_FRAGMENT,
  SOLID_VERTEX,
  VEIL_FRAGMENT,
} from "./valley-shaders";

/**
 * The home page's coffee valley (owner's brief, 6 Kas 2026: a night valley
 * of glowing coffee in the hero, "kahve çekirdekleri kullanabilirsin").
 *
 * A green night valley of coffee plants in rows, seen from a camera that
 * drifts forward along a closed curve and comes round again without a
 * seam: some 31,000 point sprites on a rolling heightfield (a third on a
 * phone). Roasted beans read first (6 Kas 2026, "kahve çekirdekleri ön
 * planda"): thousands on the ground, and a few hundred falling slowly
 * through the air round the camera, tumbling, the nearest large and out of
 * focus. On the plants: green leaves, white five-petal coffee blossoms and
 * bordo cherries; the soil's dim glints give the hills their shape. Faint
 * stars, a bordo glow on the horizon and in the slow shafts of light, dust
 * in the air, a vignette.
 *
 * Original work: the plants, the sprites (drawn in valley-shaders.ts) and
 * the motion are this file's own; nothing is fetched.
 *
 * Loaded only through `import()` from home-valley.tsx, after the page has
 * loaded and gone idle, so three.js never enters the first-load bundle
 * (tests/home-valley.test.ts) and the headline, not the canvas, is the
 * page's largest paint.
 */

export interface ValleyOptions {
  canvas: HTMLCanvasElement;
  /** Created by the caller, so a browser without WebGL 2 never downloads this. */
  context: WebGL2RenderingContext;
  /** The section: its size is the canvas's, its CSS tokens the palette. */
  stage: HTMLElement;
  /** The small type (caption, arrow): points behind it are dimmed. */
  quiet: HTMLElement | null;
  /** The name: points behind it are dimmed a little. */
  name: HTMLElement | null;
  /** A phone: a third of the points, a wider lens, a lighter touch. */
  lite: boolean;
  /** prefers-reduced-motion: one still frame, no loop, no pointer. */
  still: boolean;
  onReady: () => void;
  onLost: () => void;
}

export interface ValleyHandle {
  /** The arrow's hover: the drift eases to a stop and the plants let go. */
  setDisperse: (on: boolean) => void;
  /** The visitor's pause control (WCAG 2.2.2). */
  setPaused: (on: boolean) => void;
  dispose: () => void;
}

/** One lap of the valley, in seconds of cruising. */
const LOOP_SECONDS = 240;
/** Page scroll across the whole stage moves the camera this share of a lap. */
const SCROLL_SHARE = 0.018;
/** The camera's height over the ground: just above the plants' tops. */
const EYE = 2.5;
/** No device pixel ratio above this: the scene is soft light, not type. */
const MAX_PIXEL_RATIO = 1.5;

/** The path's plan: a loop round the hills, closed, so the drift never ends. */
const LOOP_PLAN: ReadonlyArray<readonly [number, number]> = [
  [0, -44],
  [27, -39],
  [48, -20],
  [53, 6],
  [40, 31],
  [14, 43],
  [-16, 39],
  [-40, 23],
  [-52, -2],
  [-42, -27],
  [-22, -41],
];

/** The rolling ground: a few long, slow waves. */
function ground(x: number, z: number): number {
  return (
    0.9 * Math.sin(x * 0.045 + 0.6) * Math.cos(z * 0.052) +
    0.45 * Math.sin(x * 0.11 - z * 0.07 + 1.7) +
    0.18 * Math.sin(x * 0.27 + z * 0.21)
  );
}

/** The valley's walls rise away from the lane the camera follows. */
const wall = (lateral: number) => 0.012 * lateral * lateral;

/** A small seeded generator: the same valley on every visit. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The additive light's kinds (FIELD_*) and the solid things' (SOLID_*). */
const LIGHT = { soil: 0, blossom: 1 } as const;
const THING = { leaf: 0, cherry: 1, bean: 2 } as const;

interface Layer {
  geometry: BufferGeometry;
  count: number;
}

/** Points collected in planting order, then shuffled into a geometry. */
class Planting {
  private pos: number[] = [];
  private kind: number[] = [];
  private size: number[] = [];
  private air: number[] = [];
  constructor(private readonly rand: () => number) {}

  add(x: number, y: number, z: number, k: number, s: number, air = 0) {
    this.pos.push(x, y, z);
    this.kind.push(k);
    this.size.push(s);
    this.air.push(air);
  }

  /**
   * The order is shuffled, so drawing only the first part (the slow-device
   * fallback) still covers the whole valley evenly.
   */
  build(): Layer {
    const { rand } = this;
    const count = this.kind.length;
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const position = new Float32Array(count * 3);
    const aKind = new Float32Array(count);
    const aAir = new Float32Array(count);
    const aSize = new Float32Array(count);
    const aRot = new Float32Array(count);
    const aSeed = new Float32Array(count);
    const aSpin = new Float32Array(count);
    const aDir = new Float32Array(count * 3);
    order.forEach((from, to) => {
      position[to * 3] = this.pos[from * 3];
      position[to * 3 + 1] = this.pos[from * 3 + 1];
      position[to * 3 + 2] = this.pos[from * 3 + 2];
      aKind[to] = this.kind[from];
      aAir[to] = this.air[from];
      aSize[to] = this.size[from];
      aRot[to] = rand() * Math.PI * 2;
      aSeed[to] = rand();
      // A bean in the air turns over every few seconds, either way round.
      aSpin[to] = this.air[from] ? (0.35 + rand() * 0.7) * (rand() < 0.5 ? -1 : 1) : 0;
      // Where the point floats off to: any way round, a little up.
      const turn = rand() * Math.PI * 2;
      const up = rand() * 0.6;
      const flat = Math.sqrt(1 - up * up);
      aDir[to * 3] = Math.cos(turn) * flat;
      aDir[to * 3 + 1] = up;
      aDir[to * 3 + 2] = Math.sin(turn) * flat;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("aKind", new BufferAttribute(aKind, 1));
    geometry.setAttribute("aAir", new BufferAttribute(aAir, 1));
    geometry.setAttribute("aSize", new BufferAttribute(aSize, 1));
    geometry.setAttribute("aRot", new BufferAttribute(aRot, 1));
    geometry.setAttribute("aSeed", new BufferAttribute(aSeed, 1));
    geometry.setAttribute("aSpin", new BufferAttribute(aSpin, 1));
    geometry.setAttribute("aDir", new BufferAttribute(aDir, 3));
    return { geometry, count };
  }
}

/**
 * Plants the valley: shrubs in rows on both sides of the camera's path,
 * each with leaves, a spray of blossoms and sometimes a few cherries; beans
 * on the ground; beans in the air; and the soil's glints out to the hills.
 * Returns the two layers: the light (additive) and the things (solid).
 */
function plantValley(
  curve: CatmullRomCurve3,
  lite: boolean,
): { light: Layer; things: Layer } {
  const rand = seeded(1897);
  // A phone draws a third of the points over a narrower valley, so the
  // field it sees is as full as a desktop's.
  const share = lite ? 1 / 3 : 1;
  const spread = lite ? 12 : 23;
  const shrubs = Math.round(2000 * share);
  const groundBeans = Math.round(4200 * share);
  const airBeans = Math.round(320 * share);
  const soil = Math.round(4200 * share);

  const SAMPLES = 1024;
  const along = curve.getSpacedPoints(SAMPLES);
  const side: Vector3[] = [];
  const ahead: Vector3[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = new Vector3().subVectors(along[i + 1], along[i]).setY(0);
    t.normalize();
    ahead.push(t);
    side.push(new Vector3(-t.z, 0, t.x));
  }
  const spot = (lateral: number, jitter: number) => {
    const i = Math.floor(rand() * SAMPLES);
    const c = along[i];
    const n = side[i];
    const a = ahead[i];
    const run = (rand() - 0.5) * jitter;
    const x = c.x + n.x * lateral + a.x * run;
    const z = c.z + n.z * lateral + a.z * run;
    return { x, z, y: ground(x, z) + wall(lateral) };
  };

  const light = new Planting(rand);
  const things = new Planting(rand);

  for (let s = 0; s < shrubs; s++) {
    // Rows across the valley, closer together near the camera's path; the
    // camera flies over them, so the plants grow towards it and pass
    // beneath.
    const reach = (rand() < 0.5 ? -1 : 1) * spread * Math.pow(rand(), 1.15);
    const lateral = Math.round(reach / 2) * 2 + (rand() - 0.5) * 0.5;
    const base = spot(lateral, 1.2);
    // Leaves frame the beans and blossoms, never outweigh them.
    const leaves = 3 + Math.floor(rand() * 2);
    for (let l = 0; l < leaves; l++) {
      things.add(
        base.x + (rand() - 0.5) * 1.2,
        base.y + 0.1 + rand() * 1.0,
        base.z + (rand() - 0.5) * 1.2,
        THING.leaf,
        0.3 + rand() * 0.12,
      );
    }
    const blossoms = 4 + Math.floor(rand() * 4);
    for (let b = 0; b < blossoms; b++) {
      light.add(
        base.x + (rand() - 0.5) * 1.1,
        base.y + 0.15 + rand() * 1.05,
        base.z + (rand() - 0.5) * 1.1,
        LIGHT.blossom,
        0.3 + rand() * 0.2,
      );
    }
    if (rand() < 0.35) {
      const cherries = 1 + Math.floor(rand() * 3);
      for (let c = 0; c < cherries; c++) {
        things.add(
          base.x + (rand() - 0.5) * 0.8,
          base.y + 0.2 + rand() * 0.8,
          base.z + (rand() - 0.5) * 0.8,
          THING.cherry,
          0.21 + rand() * 0.08,
        );
      }
    }
  }
  for (let b = 0; b < groundBeans; b++) {
    const p = spot((rand() * 2 - 1) * (spread + 1), 1);
    things.add(p.x, p.y + 0.08, p.z, THING.bean, 0.3 + rand() * 0.12);
  }
  // Beans in the air: a unit-box seed; the shader wraps it round the
  // camera (uBox), so they are always about it.
  for (let b = 0; b < airBeans; b++) {
    things.add(rand(), rand(), rand(), THING.bean, 0.28 + rand() * 0.22, 1);
  }
  for (let g = 0; g < soil; g++) {
    const p = spot((rand() * 2 - 1) * (spread + 3), 1);
    light.add(p.x, p.y + 0.02, p.z, LIGHT.soil, 0.07 + rand() * 0.06);
  }
  return { light: light.build(), things: things.build() };
}

/** A CSS colour token of the stage, as sRGB components for a shader. */
function token(style: CSSStyleDeclaration, name: string): Vector3 {
  const value = style.getPropertyValue(name).trim();
  if (!value) return new Vector3(0.5, 0.5, 0.5);
  const rgb = { r: 0, g: 0, b: 0 };
  new Color().setStyle(value).getRGB(rgb, SRGBColorSpace);
  return new Vector3(rgb.r, rgb.g, rgb.b);
}

export function startValley(options: ValleyOptions): ValleyHandle {
  const { canvas, context, stage, quiet, name, lite, still } = options;

  const renderer = new WebGLRenderer({
    canvas,
    context: context as unknown as WebGLRenderingContext,
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  renderer.setPixelRatio(pixelRatio);

  const style = getComputedStyle(stage);
  const palette = {
    sky: token(style, "--valley-sky"),
    ground: token(style, "--valley-ground"),
    horizon: token(style, "--valley-horizon"),
    ray: token(style, "--valley-ray"),
    star: token(style, "--valley-star"),
    blossom: token(style, "--valley-blossom"),
    heart: token(style, "--valley-blossom-heart"),
    leaf: token(style, "--valley-leaf"),
    leafLight: token(style, "--valley-leaf-light"),
    cherry: token(style, "--valley-cherry"),
    cherryLight: token(style, "--valley-cherry-light"),
    bean: token(style, "--valley-bean"),
    glint: token(style, "--valley-bean-glint"),
    shine: token(style, "--valley-shine"),
    dust: token(style, "--valley-dust"),
  };
  renderer.setClearColor(
    new Color().setRGB(palette.sky.x, palette.sky.y, palette.sky.z),
    1,
  );

  // A portrait screen sees a narrow wedge of the valley: a wider lens.
  let fov = 52;
  /** How far below the eye the camera aims, a few metres ahead. */
  let lookDown = 1.25;
  const camera = new PerspectiveCamera(fov, 1, 0.1, 120);
  const scene = new Scene();

  const curve = new CatmullRomCurve3(
    LOOP_PLAN.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    "centripetal",
  );
  curve.arcLengthDivisions = 600;

  // The sky, drawn first.
  const quad = new PlaneGeometry(2, 2);
  const skyMaterial = new ShaderMaterial({
    vertexShader: QUAD_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      uSky: { value: palette.sky },
      uGround: { value: palette.ground },
      uHorizon: { value: palette.horizon },
      uStar: { value: palette.star },
      uHorizonY: { value: 0.6 },
      uTime: { value: 0 },
      uCells: { value: 70 },
      uStarShift: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const sky = new Mesh(quad, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // The valley: the light (blossoms, soil) and the things (leaves,
  // cherries, beans on the ground and in the air).
  const { light, things } = plantValley(curve, lite);
  const pointer = new Vector2(0, -2);
  const quietRect = new Vector4(2, 2, 2, 2);
  const nameRect = new Vector4(2, 2, 2, 2);
  const camAt = new Vector3();
  // One set of uniform objects shared by every valley material, so a frame
  // writes each value once.
  const shared = {
    uTime: { value: 0 },
    uPxScale: { value: 600 },
    uMaxPoint: { value: 160 },
    uDisperse: { value: 0 },
    uPointer: { value: pointer },
    uPointerAmt: { value: 0 },
    uAspect: { value: 1 },
    uQuiet: { value: quietRect },
    uQuietDim: { value: 0.22 },
    uName: { value: nameRect },
    uNameDim: { value: 0.6 },
  };
  const lightMaterial = new ShaderMaterial({
    vertexShader: FIELD_VERTEX,
    fragmentShader: FIELD_FRAGMENT,
    uniforms: {
      ...shared,
      uBlossom: { value: palette.blossom },
      uHeart: { value: palette.heart },
      uDust: { value: palette.dust },
    },
    transparent: true,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
  });
  const thingUniforms = {
    ...shared,
    uCam: { value: camAt },
    uBox: { value: new Vector3(24, 10, 24) },
    uBean: { value: palette.bean },
    uGlint: { value: palette.glint },
    uShine: { value: palette.shine },
    uRim: { value: palette.horizon },
    uCherry: { value: palette.cherry },
    uCherryLight: { value: palette.cherryLight },
    uLeaf: { value: palette.leaf },
    uLeafLight: { value: palette.leafLight },
  };
  // The things twice: the opaque core first (writes depth), then the soft
  // fringe and everything translucent over it.
  const coreMaterial = new ShaderMaterial({
    vertexShader: SOLID_VERTEX,
    fragmentShader: SOLID_FRAGMENT,
    uniforms: thingUniforms,
    defines: { PASS: 0 },
    transparent: false,
    blending: NormalBlending,
    depthTest: true,
    depthWrite: true,
  });
  const fringeMaterial = new ShaderMaterial({
    vertexShader: SOLID_VERTEX,
    fragmentShader: SOLID_FRAGMENT,
    uniforms: thingUniforms,
    defines: { PASS: 1 },
    transparent: true,
    blending: NormalBlending,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
  });
  const thingCores = new Points(things.geometry, coreMaterial);
  const thingFringes = new Points(things.geometry, fringeMaterial);
  const lights = new Points(light.geometry, lightMaterial);
  thingCores.renderOrder = 0;
  thingFringes.renderOrder = 1;
  lights.renderOrder = 2;
  for (const layer of [thingCores, thingFringes, lights]) {
    layer.frustumCulled = false;
    scene.add(layer);
  }

  // Dust in the air round the camera.
  const motes = lite ? 160 : 420;
  const rand = seeded(2026);
  const dustPos = new Float32Array(motes * 3);
  const dustSeed = new Float32Array(motes);
  for (let i = 0; i < motes; i++) {
    dustPos[i * 3] = rand();
    dustPos[i * 3 + 1] = rand();
    dustPos[i * 3 + 2] = rand();
    dustSeed[i] = rand();
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(dustPos, 3));
  dustGeometry.setAttribute("aSeed", new BufferAttribute(dustSeed, 1));
  const dustMaterial = new ShaderMaterial({
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uPxScale: { value: 600 },
      uCam: { value: new Vector3() },
      uBox: { value: new Vector3(26, 9, 26) },
      uDust: { value: palette.dust },
    },
    transparent: true,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: false,
  });
  const dust = new Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  dust.renderOrder = 3;
  scene.add(dust);

  // The rays and the vignette, drawn last.
  const veilMaterial = new ShaderMaterial({
    vertexShader: QUAD_VERTEX,
    fragmentShader: VEIL_FRAGMENT,
    uniforms: {
      uRay: { value: palette.ray },
      uWarm: { value: palette.horizon },
      uTime: { value: 0 },
      uAspect: { value: 1 },
    },
    transparent: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
  });
  const veil = new Mesh(quad, veilMaterial);
  veil.frustumCulled = false;
  veil.renderOrder = 10;
  scene.add(veil);

  const glMaxPoint = (
    context.getParameter(context.ALIASED_POINT_SIZE_RANGE) as Float32Array
  )[1];

  // ── Size and the quiet zone ─────────────────────────────────────────
  let width = 1;
  let height = 1;
  const measure = () => {
    const box = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    fov = width < height ? 70 : lite ? 60 : 52;
    lookDown = width < height ? 1.9 : lite ? 1.5 : 1.25;
    camera.fov = fov;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const pxScale =
      (height * pixelRatio) / (2 * Math.tan((fov * Math.PI) / 360));
    shared.uPxScale.value = pxScale;
    dustMaterial.uniforms.uPxScale.value = pxScale;
    shared.uMaxPoint.value = Math.min(
      glMaxPoint || 64,
      150 * pixelRatio,
    );
    shared.uAspect.value = width / height;
    skyMaterial.uniforms.uRes.value.set(
      width * pixelRatio,
      height * pixelRatio,
    );
    veilMaterial.uniforms.uAspect.value = width / height;
    const zone = (el: HTMLElement | null, into: Vector4) => {
      if (!el) return;
      const q = el.getBoundingClientRect();
      into.set(
        ((q.left - box.left) / width) * 2 - 1,
        1 - ((q.bottom - box.top) / height) * 2,
        ((q.right - box.left) / width) * 2 - 1,
        1 - ((q.top - box.top) / height) * 2,
      );
    };
    zone(quiet, quietRect);
    zone(name, nameRect);
  };

  // ── Motion state ────────────────────────────────────────────────────
  let time = still ? 38 : 0;
  let travel = still ? 0.11 : 0.02;
  let disperse = 0;
  let disperseTarget = 0;
  let cruise = 1;
  let pointerAmt = 0;
  let pointerHot = 0;
  let pointerMouse = false;
  let lastMove = -1e9;
  let scroll = 0;
  const pointerTarget = new Vector2(0, -2);
  const tilt = new Vector2();
  const tiltTarget = new Vector2();
  const here = new Vector3();
  const there = new Vector3();
  const across = new Vector3();
  const UP = new Vector3(0, 1, 0);

  // The camera's heading, unwrapped, so the stars turn with it without a
  // jump when the angle passes ±π.
  let heading = Number.NaN;
  let turned = 0;

  const place = () => {
    const u = (((travel + scroll * SCROLL_SHARE) % 1) + 1) % 1;
    curve.getPointAt(u, here);
    curve.getPointAt((u + 0.016) % 1, there);
    here.y = ground(here.x, here.z) + EYE;
    there.y = ground(there.x, there.z) + EYE - lookDown;
    across.subVectors(there, here).cross(UP).normalize();
    const reach = Math.hypot(there.x - here.x, there.z - here.z);
    there
      .addScaledVector(across, tilt.x * 1.4)
      .addScaledVector(UP, tilt.y * 0.6);
    camera.position.copy(here);
    camera.lookAt(there);
    // Where the horizon falls on the screen, for the sky's glow.
    const pitch = Math.atan2(here.y - there.y, reach);
    const horizon =
      0.5 + (0.5 * Math.tan(pitch)) / Math.tan((fov * Math.PI) / 360);
    skyMaterial.uniforms.uHorizonY.value = Math.min(
      0.95,
      Math.max(0.2, horizon),
    );
    dustMaterial.uniforms.uCam.value.copy(here);
    camAt.copy(here);
    const facing = Math.atan2(there.x - here.x, there.z - here.z);
    if (!Number.isNaN(heading)) {
      let delta = facing - heading;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      turned += delta;
    }
    heading = facing;
    const halfWide = Math.atan(Math.tan((fov * Math.PI) / 360) * camera.aspect);
    // Turning right carries the stars left across the screen.
    skyMaterial.uniforms.uStarShift.value =
      (-turned / (2 * halfWide)) * camera.aspect * 70;
  };

  const update = (dt: number, now: number) => {
    time += dt;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    disperse +=
      (disperseTarget - disperse) * ease(disperseTarget > disperse ? 1.5 : 1.1);
    cruise += (1 - disperseTarget - cruise) * ease(1.4);
    travel += (dt * Math.max(0, cruise)) / LOOP_SECONDS;

    const hot = now - lastMove < (pointerMouse ? 4000 : 1600) ? pointerHot : 0;
    pointerAmt += (hot - pointerAmt) * ease(3);
    pointer.lerp(pointerTarget, ease(9));
    tiltTarget.set(
      pointerMouse && hot ? pointerTarget.x : 0,
      pointerMouse && hot ? pointerTarget.y : 0,
    );
    tilt.lerp(tiltTarget, ease(1.2));

    const box = stage.getBoundingClientRect();
    const scrolled = Math.min(
      1,
      Math.max(0, -box.top / Math.max(1, box.height)),
    );
    scroll += (scrolled - scroll) * ease(4);

    shared.uTime.value = time;
    shared.uDisperse.value = disperse;
    shared.uPointerAmt.value = pointerAmt;
    dustMaterial.uniforms.uTime.value = time;
    veilMaterial.uniforms.uTime.value = time;
    skyMaterial.uniforms.uTime.value = time;
    place();
  };

  const draw = () => renderer.render(scene, camera);

  // ── The loop: only while seen, in a visible tab, and not paused ─────
  let raf = 0;
  let last = 0;
  let running = false;
  let ready = false;
  let disposed = false;
  let lost = false;
  let visible = true;
  let paused = false;
  let degrade = 0;
  let windowFrames = 0;
  let windowTime = 0;

  /**
   * A device that cannot hold ~30 fps gets a lighter scene: first the pixel
   * ratio drops to 1, then half the points are drawn. Measured over 90
   * frames after a 45-frame settle, twice at most.
   */
  const adapt = (dt: number) => {
    if (degrade >= 2) return;
    windowFrames += 1;
    if (windowFrames <= 45) return;
    windowTime += dt;
    if (windowFrames < 135) return;
    const average = windowTime / 90;
    windowFrames = 0;
    windowTime = 0;
    if (average <= 1 / 30) return;
    degrade += 1;
    if (pixelRatio > 1) {
      pixelRatio = 1;
      measure();
    } else {
      light.geometry.setDrawRange(0, Math.floor(light.count * 0.5));
      things.geometry.setDrawRange(0, Math.floor(things.count * 0.5));
    }
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    update(dt, now);
    draw();
    adapt(dt);
  };

  const sync = () => {
    const on =
      ready &&
      !disposed &&
      !lost &&
      !still &&
      visible &&
      !paused &&
      !document.hidden;
    if (on && !running) {
      running = true;
      last = performance.now();
      windowFrames = 0;
      windowTime = 0;
      raf = requestAnimationFrame(tick);
    } else if (!on && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  // ── Listeners ───────────────────────────────────────────────────────
  const onPointer = (e: PointerEvent) => {
    const box = stage.getBoundingClientRect();
    pointerTarget.set(
      ((e.clientX - box.left) / box.width) * 2 - 1,
      1 - ((e.clientY - box.top) / box.height) * 2,
    );
    pointerMouse = e.pointerType === "mouse" || e.pointerType === "pen";
    pointerHot = pointerMouse ? 1 : lite ? 0.45 : 0.6;
    if (pointerAmt < 0.02) pointer.copy(pointerTarget);
    lastMove = performance.now();
  };
  const onLeave = () => {
    pointerHot = 0;
  };
  const onVisibility = () => sync();
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    sync();
    options.onLost();
  };
  if (!still) {
    stage.addEventListener("pointermove", onPointer, { passive: true });
    stage.addEventListener("pointerdown", onPointer, { passive: true });
    stage.addEventListener("pointerleave", onLeave, { passive: true });
  }
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);

  let measureQueued = 0;
  const resized = new ResizeObserver(() => {
    cancelAnimationFrame(measureQueued);
    measureQueued = requestAnimationFrame(() => {
      if (disposed || lost) return;
      measure();
      if (ready && !running) {
        place();
        draw();
      }
    });
  });
  resized.observe(stage);
  if (quiet) resized.observe(quiet);

  const seen = new IntersectionObserver(
    ([entry]) => {
      visible = entry?.isIntersecting ?? true;
      sync();
    },
    { threshold: 0 },
  );
  seen.observe(stage);

  // ── First frame: compile off the main thread where the browser can ───
  measure();
  place();
  renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      if (disposed || lost) return;
      update(0, performance.now());
      draw();
      ready = true;
      options.onReady();
      sync();
    });

  return {
    setDisperse(on) {
      if (still) return;
      disperseTarget = on ? 1 : 0;
    },
    setPaused(on) {
      paused = on;
      sync();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(measureQueued);
      running = false;
      resized.disconnect();
      seen.disconnect();
      stage.removeEventListener("pointermove", onPointer);
      stage.removeEventListener("pointerdown", onPointer);
      stage.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      light.geometry.dispose();
      things.geometry.dispose();
      dustGeometry.dispose();
      quad.dispose();
      lightMaterial.dispose();
      coreMaterial.dispose();
      fringeMaterial.dispose();
      dustMaterial.dispose();
      skyMaterial.dispose();
      veilMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
