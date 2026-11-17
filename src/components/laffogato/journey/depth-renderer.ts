import { DEPTH_STRENGTH } from "./config";
import type { Frame } from "./sequence";

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/**
 * Two neighbouring frames, cover-fitted and dissolved into each other by
 * `uMix`, each pixel of each pushed along the pointer by how near it is:
 * the depth map's white comes towards the pointer, its black goes away, and
 * mid grey stays put.
 */
const FRAGMENT = `
precision highp float;
uniform sampler2D uColorA;
uniform sampler2D uDepthA;
uniform sampler2D uColorB;
uniform sampler2D uDepthB;
uniform float uMix;
uniform vec2 uPointer;
uniform vec2 uStrength;
uniform vec2 uCoverScale;
varying vec2 vUv;
vec4 shifted(sampler2D color, sampler2D depthMap, vec2 uv) {
  float depth = texture2D(depthMap, uv).r;
  vec2 displaced = uv + uPointer * uStrength * (depth - 0.5) * 2.0;
  displaced = clamp(displaced, vec2(0.008), vec2(0.992));
  return texture2D(color, displaced);
}
void main() {
  vec2 uv = (vUv - 0.5) * uCoverScale + 0.5;
  vec4 a = shifted(uColorA, uDepthA, uv);
  gl_FragColor = uMix > 0.0 ? mix(a, shifted(uColorB, uDepthB, uv), uMix) : a;
}`;

/** One frame's two textures, and the frame they currently hold. */
interface Slot {
  colour: WebGLTexture;
  depth: WebGLTexture;
  holds: Frame | null;
}

interface Program {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  slots: [Slot, Slot];
  colourA: WebGLUniformLocation | null;
  depthA: WebGLUniformLocation | null;
  colourB: WebGLUniformLocation | null;
  depthB: WebGLUniformLocation | null;
  mix: WebGLUniformLocation | null;
  pointer: WebGLUniformLocation | null;
  cover: WebGLUniformLocation | null;
}

/** What to draw: frame `a`, dissolved `mix` of the way (0..1) into `b`. */
export interface FramePair {
  a: Frame;
  b: Frame;
  mix: number;
}

/**
 * Draws the journey's frames into a canvas with depth parallax (WebGL 1).
 *
 * While the scroll moves, the picture is the two frames either side of it,
 * dissolved; at rest it is one frame (home-journey.tsx). A frame's textures
 * are uploaded once, when it first comes up: moving on by one frame uploads
 * the new neighbour and reuses the other. Nothing is drawn while nothing
 * has changed. `preserveDrawingBuffer` is on because the glass behind the
 * cards copies this canvas (glass-blur.ts).
 *
 * Where WebGL is not available the same frames are drawn flat with a 2D
 * context: the journey still plays, without the parallax.
 */
export class DepthRenderer {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private flat: CanvasRenderingContext2D | null = null;
  private built: Program | null = null;
  private drawn = "";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (this.gl) {
      canvas.addEventListener("webglcontextlost", this.onLost);
      canvas.addEventListener("webglcontextrestored", this.onRestored);
      this.built = this.build(this.gl);
    }
    if (!this.built) {
      this.gl = null;
      this.flat = canvas.getContext("2d");
    }
  }

  /** Whether the picture moves with the pointer here. */
  get parallax() {
    return this.gl !== null;
  }

  /**
   * Draws the pair. Returns true when the canvas changed (the glass copies
   * then need redrawing too).
   */
  draw(pair: FramePair, pointerX: number, pointerY: number): boolean {
    const { canvas } = this;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return false;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      this.drawn = "";
    }
    const mix = pair.a === pair.b ? 0 : pair.mix;
    const { a, b } = pair;

    if (this.flat) {
      const signature = `${a.colour.src}|${b.colour.src}|${mix.toFixed(2)}`;
      if (signature === this.drawn) return false;
      this.cover(this.flat, a, width, height, 1);
      if (mix > 0) this.cover(this.flat, b, width, height, mix);
      this.drawn = signature;
      return true;
    }

    const { gl, built } = this;
    if (!gl || !built || gl.isContextLost()) return false;
    const [first, second] = built.slots;
    // Each frame keeps the slot it is already in; a new one takes the slot
    // the other frame is not using.
    const slotA =
      first.holds === a ? first : second.holds === a ? second : null;
    const slotB =
      first.holds === b ? first : second.holds === b ? second : null;
    const forA = slotA ?? (slotB === first ? second : first);
    const forB = mix > 0 ? (slotB ?? (forA === first ? second : first)) : forA;
    const signature = [
      forA === first ? 0 : 1,
      forB === first ? 0 : 1,
      mix.toFixed(3),
      pointerX.toFixed(4),
      pointerY.toFixed(4),
    ].join("|");
    if (forA.holds === a && forB.holds === b && signature === this.drawn)
      return false;

    gl.viewport(0, 0, width, height);
    gl.useProgram(built.program);
    this.upload(gl, forA, a, forA === first ? 0 : 2);
    if (forB !== forA) this.upload(gl, forB, b, forB === first ? 0 : 2);
    gl.uniform1i(built.colourA, forA === first ? 0 : 2);
    gl.uniform1i(built.depthA, forA === first ? 1 : 3);
    gl.uniform1i(built.colourB, forB === first ? 0 : 2);
    gl.uniform1i(built.depthB, forB === first ? 1 : 3);
    gl.uniform1f(built.mix, mix);
    gl.uniform2f(built.pointer, pointerX, pointerY);
    const view = width / height;
    const image = a.colour.naturalWidth / a.colour.naturalHeight;
    if (view > image) gl.uniform2f(built.cover, 1, image / view);
    else gl.uniform2f(built.cover, view / image, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.drawn = signature;
    return true;
  }

  dispose() {
    const { canvas, gl, built } = this;
    canvas.removeEventListener("webglcontextlost", this.onLost);
    canvas.removeEventListener("webglcontextrestored", this.onRestored);
    if (gl && built) {
      for (const slot of built.slots) {
        gl.deleteTexture(slot.colour);
        gl.deleteTexture(slot.depth);
      }
      gl.deleteBuffer(built.buffer);
      gl.deleteProgram(built.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.built = null;
    this.gl = null;
    this.flat = null;
  }

  /** A frame's picture and depth into a slot's two textures, once. */
  private upload(
    gl: WebGLRenderingContext,
    slot: Slot,
    frame: Frame,
    unit: number,
  ) {
    if (slot.holds === frame) return;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, slot.colour);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      frame.colour,
    );
    gl.activeTexture(gl.TEXTURE0 + unit + 1);
    gl.bindTexture(gl.TEXTURE_2D, slot.depth);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      frame.depth,
    );
    slot.holds = frame;
  }

  /** The 2D fallback: one frame, cover-fitted, at an opacity. */
  private cover(
    ctx: CanvasRenderingContext2D,
    frame: Frame,
    width: number,
    height: number,
    alpha: number,
  ) {
    const scale = Math.max(
      width / frame.colour.naturalWidth,
      height / frame.colour.naturalHeight,
    );
    const w = frame.colour.naturalWidth * scale;
    const h = frame.colour.naturalHeight * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(frame.colour, (width - w) / 2, (height - h) / 2, w, h);
    ctx.globalAlpha = 1;
  }

  private onLost = (event: Event) => {
    // Ask for it back; until then nothing is drawn.
    event.preventDefault();
    this.built = null;
  };

  private onRestored = () => {
    if (!this.gl) return;
    this.built = this.build(this.gl);
    this.drawn = "";
  };

  private build(gl: WebGLRenderingContext): Program | null {
    const program = link(gl, VERTEX, FRAGMENT);
    const buffer = gl.createBuffer();
    const textures = [0, 1, 2, 3].map(() => gl.createTexture());
    const [colour0, depth0, colour1, depth1] = textures;
    if (!program || !buffer || !colour0 || !depth0 || !colour1 || !depth1)
      return null;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    // Slot 0 lives on texture units 0 and 1, slot 1 on units 2 and 3.
    [colour0, depth0, colour1, depth1].forEach((texture, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      // A texture with no image yet must still be complete to be sampled.
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        1,
        1,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0]),
      );
    });

    gl.useProgram(program);
    gl.uniform2f(
      gl.getUniformLocation(program, "uStrength"),
      DEPTH_STRENGTH.x,
      DEPTH_STRENGTH.y,
    );
    return {
      program,
      buffer,
      slots: [
        { colour: colour0, depth: depth0, holds: null },
        { colour: colour1, depth: depth1, holds: null },
      ],
      colourA: gl.getUniformLocation(program, "uColorA"),
      depthA: gl.getUniformLocation(program, "uDepthA"),
      colourB: gl.getUniformLocation(program, "uColorB"),
      depthB: gl.getUniformLocation(program, "uDepthB"),
      mix: gl.getUniformLocation(program, "uMix"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      cover: gl.getUniformLocation(program, "uCoverScale"),
    };
  }
}

/** Compiles and links a program; null (and a console line) if it fails. */
export function link(
  gl: WebGLRenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("journey: shader", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    gl.attachShader(program, shader);
    // Flagged now, freed with the program.
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("journey: program", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
