import { link } from "./depth-renderer";

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/**
 * The preloader's sheet and the way it goes: a sheet of the site's cream
 * that burns away from the middle outward along a noisy edge. The paper
 * browns towards the roast as the edge nears it, and the edge itself is a
 * thin line of ember.
 *
 * uProgress 0 is the whole sheet, 1 is nothing left on any screen: `reach`
 * is 1.02 at 16:10 and narrower, grows with the corner's distance on wider
 * screens, and carries 0.06 more for the noisiest corners.
 */
const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uProgress;
uniform float uTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(13.7, 8.4); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / uResolution.y;
  float n = fbm(uv * 3.1 + vec2(uTime * 0.035, -uTime * 0.025));
  float detail = fbm(uv * 8.4 - vec2(uTime * 0.02));
  float field = length(p) + (n - 0.5) * 0.24 + (detail - 0.5) * 0.065;
  float reach = max(1.02, 1.02 * length(vec2(0.5 * uResolution.x / uResolution.y, 0.5)) / 0.9434) + 0.06;
  float threshold = mix(-0.22, reach, uProgress);
  float edge = 0.045;
  float alpha = smoothstep(threshold - edge, threshold + edge, field);
  float rim = 1.0 - smoothstep(0.006, 0.052, abs(field - threshold));
  float coverage = max(alpha, rim * 0.18);
  vec3 paper = vec3(250.0, 247.0, 242.0) / 255.0;
  vec3 roast = vec3(35.0, 18.0, 11.0) / 255.0;
  vec3 ember = vec3(222.0, 133.0, 58.0) / 255.0;
  // The paper browns as the edge comes for it (not before the burn starts).
  float scorch = (1.0 - smoothstep(0.0, 0.13, field - threshold)) * smoothstep(0.0, 0.06, uProgress);
  vec3 color = mix(paper, roast, scorch * scorch * 0.86);
  color = mix(color, mix(ember, vec3(1.0, 0.85, 0.62), rim), rim * 0.92);
  gl_FragColor = vec4(color * coverage, coverage);
}`;

/** The preloader's burning sheet (WebGL 1). */
export class BurnRenderer {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private resolution: WebGLUniformLocation | null = null;
  private progress: WebGLUniformLocation | null = null;
  private time: WebGLUniformLocation | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    const gl = this.gl;
    if (!gl) return;
    this.program = link(gl, VERTEX, FRAGMENT);
    this.buffer = gl.createBuffer();
    if (!this.program || !this.buffer) {
      this.gl = null;
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(this.program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(this.program);
    this.resolution = gl.getUniformLocation(this.program, "uResolution");
    this.progress = gl.getUniformLocation(this.program, "uProgress");
    this.time = gl.getUniformLocation(this.program, "uTime");
  }

  /** False where there is no WebGL: the preloader then simply fades. */
  get ok() {
    return this.gl !== null;
  }

  /** Draws the sheet at `progress` (0 whole, 1 gone). */
  draw(progress: number, timeSeconds: number): boolean {
    const { canvas, gl } = this;
    if (!gl || gl.isContextLost()) return false;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return false;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.resolution, width, height);
    gl.uniform1f(this.progress, progress);
    gl.uniform1f(this.time, timeSeconds);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }

  dispose() {
    const { gl } = this;
    if (!gl) return;
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
  }
}
