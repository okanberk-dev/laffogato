/**
 * The GLSL behind the home page's coffee valley (valley-scene.ts). Kept
 * apart so the scene file reads as the scene: what is placed where, and how
 * the camera moves.
 *
 * Every sprite is drawn here, in the fragment shader - no image is fetched.
 * Colours arrive as uniforms in sRGB, read from the stage's CSS tokens
 * (globals.css `.valley`), and leave unconverted: what the token says is
 * what is painted. The points are additive, so a sprite's falloff is its
 * glow (a bloom without a bloom pass) and depth needs no sorting.
 */

/** A full-screen quad: the sky behind, the rays and the vignette in front. */
export const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The night: dark above, a low warm glow on the horizon, darker ground, and
 * a sparse field of faint stars that turns with the camera (`uStarShift`,
 * in star cells) and twinkles slowly.
 */
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uStar;
uniform float uHorizonY;
uniform float uTime;
uniform float uCells;
uniform float uStarShift;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float h = vUv.y - uHorizonY;
  vec3 col = mix(uSky * 0.72, uSky, smoothstep(-0.35, 0.05, h));
  col = mix(col, uSky * 0.55, smoothstep(0.05, 0.75, h));
  col += uHorizon * exp(-h * h * 22.0) * 0.45;
  col += uGlow * exp(-h * h * 140.0) * 0.07;

  vec2 sp = gl_FragCoord.xy / uRes.y * uCells + vec2(uStarShift, 0.0);
  vec2 cell = floor(sp);
  float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  vec2 at = vec2(fract(seed * 13.7), fract(seed * 29.3)) - 0.5;
  float star = step(0.94, seed)
    * (1.0 - smoothstep(0.0, 0.1 + 0.08 * fract(seed * 7.1), length(fract(sp) - 0.5 - at * 0.6)));
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.4 + seed) + seed * 60.0);
  col += uStar * star * twinkle * smoothstep(0.03, 0.3, h) * 0.8;
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * In front of everything: a few slow shafts of light from above, and the
 * vignette. Blended ONE / ONE_MINUS_SRC_ALPHA, so the colour adds (the
 * rays) and the alpha darkens what is under it (the vignette).
 */
export const VEIL_FRAGMENT = /* glsl */ `
uniform vec3 uRay;
uniform float uTime;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - vec2(0.34, 1.32)) * vec2(uAspect, 1.0);
  float ang = atan(d.x, -d.y);
  float rays = smoothstep(0.62, 1.0, 0.5 + 0.5 * sin(ang * 7.0 + uTime * 0.045)) * 0.55;
  rays += smoothstep(0.7, 1.0, 0.5 + 0.5 * sin(ang * 13.0 - uTime * 0.03 + 1.7)) * 0.3;
  rays += smoothstep(0.78, 1.0, 0.5 + 0.5 * sin(ang * 21.0 + uTime * 0.02 + 4.1)) * 0.18;
  float fall = (1.0 - smoothstep(0.25, 2.1, length(d))) * smoothstep(0.05, 0.85, vUv.y);
  vec3 ray = uRay * rays * fall * 0.075;
  vec2 v = (vUv - 0.5) * vec2(1.0, 1.1);
  float vig = smoothstep(0.32, 0.9, length(v)) * 0.82;
  gl_FragColor = vec4(ray, vig);
}
`;

/**
 * The valley's points: blossoms, beans, cherries and the soil's glints.
 *
 * Each point grows as the camera nears it and fades into the dark with
 * distance; very near ones fade out instead of filling the screen. The
 * pointer pushes points away in screen space and lights the nearest; the
 * arrow's hover lifts every point off its plant into a floating particle
 * (`uDisperse`). The copy's small type sits in a quiet zone (`uQuiet`,
 * NDC) where every point is dimmed, so the caption keeps its contrast; the
 * name has a milder one of its own (`uName`).
 */
export const POINTS_VERTEX = /* glsl */ `
attribute float aKind;
attribute float aSize;
attribute float aRot;
attribute float aSeed;
attribute vec3 aDir;
uniform float uTime;
uniform float uPxScale;
uniform float uMaxPoint;
uniform float uDisperse;
uniform vec2 uPointer;
uniform float uPointerAmt;
uniform float uAspect;
uniform vec4 uQuiet;
uniform float uQuietDim;
uniform vec4 uName;
uniform float uNameDim;
varying float vKind;
varying float vRot;
varying float vAlpha;
varying float vGlow;
varying float vMorph;
varying float vBlur;

void main() {
  vec3 p = position;
  float flower = step(0.5, aKind) * step(aKind, 1.5);
  float t = uTime;
  // A breath of night air through the blossoms.
  p.x += sin(t * 0.7 + aSeed * 37.0 + p.z * 0.2) * 0.035 * flower;
  p.y += sin(t * 0.9 + aSeed * 53.0) * 0.02 * flower;

  // Lifted off the plant: each point leaves at its own moment and floats.
  float lift = clamp(uDisperse * 1.4 - aSeed * 0.4, 0.0, 1.0);
  lift = lift * lift * (3.0 - 2.0 * lift);
  vec3 drift = vec3(
    sin(t * 0.53 + aSeed * 31.0),
    0.4 + 0.6 * sin(t * 0.41 + aSeed * 17.0),
    cos(t * 0.47 + aSeed * 23.0)
  );
  p += (aDir * (1.0 + aSeed * 2.6) + vec3(0.0, 0.25 + aSeed * 0.9, 0.0) + drift * 0.5) * lift;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vec4 clip = projectionMatrix * mv;
  float w = max(clip.w, 0.001);
  vec2 ndc = clip.xy / w;

  // The pointer: strongest at the cursor, gone at 0.42 of the height.
  vec2 delta = (ndc - uPointer) * vec2(uAspect, 1.0);
  float pd = length(delta);
  float near = 1.0 - smoothstep(0.0, 0.42, pd);
  float touch = uPointerAmt * near * near;
  ndc += (delta / max(pd, 0.0001)) / vec2(uAspect, 1.0) * touch * 0.14;
  clip.xy = ndc * clip.w;
  gl_Position = clip;

  float grow = mix(0.3, 1.0, smoothstep(34.0, 5.0, dist));
  float size = aSize * grow * uPxScale / max(dist, 0.1);
  size *= 1.0 + touch * 0.55 + lift * 0.15;

  float nearFade = smoothstep(0.9, 2.6, dist);
  float fog = 1.0 - smoothstep(14.0, 56.0, dist);
  vec2 q = max(uQuiet.xy - ndc, ndc - uQuiet.zw);
  float quiet = mix(uQuietDim, 1.0, smoothstep(0.0, 0.16, length(max(q, 0.0))));
  vec2 m = max(uName.xy - ndc, ndc - uName.zw);
  quiet *= mix(uNameDim, 1.0, smoothstep(0.0, 0.12, length(max(m, 0.0))));
  // A sprite smaller than a pixel fades rather than shimmers.
  float sub = clamp(size / 1.6, 0.0, 1.0);

  vAlpha = nearFade * fog * quiet * sub * (1.0 + touch * 1.3);
  vGlow = touch;
  vMorph = lift;
  // The nearest sprites go soft, as a lens focused on the field would.
  vBlur = 1.0 - smoothstep(1.8, 5.5, dist);
  vKind = aKind;
  vRot = aRot + t * 0.06 * (aSeed - 0.5);
  gl_PointSize = clamp(size, 1.0, uMaxPoint);
}
`;

export const POINTS_FRAGMENT = /* glsl */ `
uniform vec3 uBlossom;
uniform vec3 uHeart;
uniform vec3 uBean;
uniform vec3 uBeanGlow;
uniform vec3 uCherry;
uniform vec3 uCherryLight;
uniform vec3 uDust;
varying float vKind;
varying float vRot;
varying float vAlpha;
varying float vGlow;
varying float vMorph;
varying float vBlur;

vec2 turn(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float r = length(p);
  if (r > 1.0) discard;
  vec2 q = turn(p, vRot);
  vec3 col;
  float a;

  if (vKind < 0.5) {
    // The soil's glints and the air's dust: a soft round light.
    a = exp(-r * r * 5.0);
    col = uDust;
  } else if (vKind < 1.5) {
    // A coffee blossom: five long oval petals, jasmine-like, round a
    // warm heart. Each petal is an ellipse along its own axis.
    float sector = 1.2566371;
    float ang = atan(q.y, q.x);
    float off = mod(ang + sector * 0.5, sector) - sector * 0.5;
    vec2 leaf = vec2(cos(off), sin(off)) * r;
    vec2 e = (leaf - vec2(0.46, 0.0)) / vec2(0.46, 0.19);
    float petal = 1.0 - smoothstep(0.78 - vBlur * 0.55, 1.0 + vBlur * 0.1, length(e));
    float vein = 1.0 - min(abs(e.y), 1.0) * 0.28;
    float heart = 1.0 - smoothstep(0.07, 0.16, r);
    float halo = exp(-r * r * 5.0) * 0.3;
    col = mix(uBlossom * vein, uHeart, heart);
    a = max(max(petal, heart) * 0.92, halo);
  } else if (vKind < 2.5) {
    // A roasted bean, lit from above, the crease down its flat face, and
    // a warm glow round it.
    vec2 e = q / vec2(0.44, 0.64);
    float er = length(e);
    float body = 1.0 - smoothstep(0.86, 1.0, er);
    float crease = 1.0 - smoothstep(0.03, 0.085, abs(q.x - 0.07 * sin(q.y * 5.5)));
    crease *= 1.0 - smoothstep(0.42, 0.6, abs(q.y));
    vec3 n = normalize(vec3(e * 0.9, sqrt(max(1.0 - er * er, 0.0))));
    float lit = 0.5 + 0.5 * max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0);
    float shine = pow(max(dot(n, normalize(vec3(-0.3, 0.45, 0.85))), 0.0), 18.0);
    vec3 bean = uBean * lit * (1.0 - crease * 0.7) + uBeanGlow * shine * 0.6;
    float halo = exp(-er * er * 1.3) * 0.5;
    col = mix(uBeanGlow, bean, body);
    a = max(body * 0.95, halo);
  } else {
    // A ripe cherry: deep red, one highlight, a faint red glow.
    float body = 1.0 - smoothstep(0.46, 0.56, r);
    float hi = 1.0 - smoothstep(0.0, 0.15, length(p - vec2(-0.17, 0.19)));
    float halo = exp(-r * r * 3.2) * 0.38;
    col = mix(uCherry * (1.35 - r), uCherryLight, hi * 0.75);
    col = mix(uCherry, col, body);
    a = max(body, halo);
  }

  // Lifted off the plant, every sprite becomes a floating glow.
  float orb = exp(-r * r * 6.0);
  col = mix(col, mix(col, uBeanGlow, 0.4), vMorph);
  a = mix(a, orb * 0.85, vMorph);
  col += vGlow * 0.22;
  a *= vAlpha * (1.0 - vBlur * 0.35);
  gl_FragColor = vec4(col * a, a);
}
`;

/** Dust in the air round the camera, wrapped in a box that travels with it. */
export const DUST_VERTEX = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPxScale;
uniform vec3 uCam;
uniform vec3 uBox;
varying float vAlpha;
void main() {
  vec3 p = position * uBox;
  p += vec3(
    sin(uTime * 0.11 + aSeed * 20.0) * 0.8,
    uTime * (0.05 + aSeed * 0.08),
    cos(uTime * 0.09 + aSeed * 13.0) * 0.8
  );
  vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 edge = abs(rel) / (uBox * 0.5);
  float fade = 1.0 - smoothstep(0.7, 1.0, max(edge.x, max(edge.y, edge.z)));
  vec4 mv = modelViewMatrix * vec4(uCam + rel, 1.0);
  float dist = -mv.z;
  gl_Position = projectionMatrix * mv;
  float size = (0.035 + aSeed * 0.03) * uPxScale / max(dist, 0.1);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
  vAlpha = fade * twinkle * smoothstep(0.6, 2.0, dist) * clamp(size / 1.5, 0.0, 1.0) * 0.55;
  gl_PointSize = clamp(size, 1.0, 24.0);
}
`;

export const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uDust;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a = exp(-dot(p, p) * 4.0) * vAlpha;
  gl_FragColor = vec4(uDust * a, a);
}
`;
