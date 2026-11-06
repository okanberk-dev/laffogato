/**
 * The GLSL behind the home page's coffee valley (valley-scene.ts). Kept
 * apart so the scene file reads as the scene: what is placed where, and how
 * the camera moves.
 *
 * Every sprite is drawn here, in the fragment shader - no image is fetched.
 * Colours arrive as uniforms in sRGB, read from the stage's CSS tokens
 * (globals.css `.valley`), and leave unconverted: what the token says is
 * what is painted.
 *
 * Two kinds of sprite. Light (the blossoms and the soil's glints) is
 * additive: its falloff is its glow, a bloom without a bloom pass, and it
 * needs no sorting. Things (beans, cherries, leaves) are solid and keep
 * their own colour: each is drawn twice, an opaque core that writes depth
 * and a soft fringe blended over it, so a bean hides the blossoms behind
 * it and the blossoms in front still light it - no per-frame sort.
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
 * The night: deep green above, the land's green haze below, a bordo glow
 * on the horizon, and a sparse field of faint stars that turns with the
 * camera (`uStarShift`, in star cells) and twinkles slowly.
 */
export const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uHorizon;
uniform vec3 uStar;
uniform float uHorizonY;
uniform float uTime;
uniform float uCells;
uniform float uStarShift;
uniform vec2 uRes;
varying vec2 vUv;
void main() {
  float h = vUv.y - uHorizonY;
  vec3 col = mix(uGround * 0.62, uSky, smoothstep(-0.32, 0.04, h));
  col = mix(col, uSky * 0.58, smoothstep(0.05, 0.8, h));
  col += uHorizon * exp(-h * h * 20.0) * 0.42;
  col += uHorizon * exp(-h * h * 160.0) * 0.12;

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
 * In front of everything: a few slow shafts of bordo-warm light from above,
 * and the vignette. Blended ONE / ONE_MINUS_SRC_ALPHA, so the colour adds
 * (the rays) and the alpha darkens what is under it (the vignette).
 */
export const VEIL_FRAGMENT = /* glsl */ `
uniform vec3 uRay;
uniform vec3 uWarm;
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
  vec3 ray = mix(uWarm * 1.5, uRay, 0.4) * rays * fall * 0.08;
  vec2 v = (vUv - 0.5) * vec2(1.0, 1.1);
  float vig = smoothstep(0.32, 0.9, length(v)) * 0.8;
  gl_FragColor = vec4(ray, vig);
}
`;

/**
 * What every valley sprite shares on the way to the screen: the lift off
 * the plant when the menu arrow is hovered (`uDisperse`), the pointer's push
 * in screen space (strongest at the cursor, gone at 0.42 of the height), and
 * the two quiet zones where points are dimmed - the small type's (`uQuiet`)
 * and the wordmark's (`uName`), both in NDC.
 */
const PLACE = /* glsl */ `
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

vec3 liftOff(vec3 p, vec3 dir, float seed, out float lift) {
  lift = clamp(uDisperse * 1.4 - seed * 0.4, 0.0, 1.0);
  lift = lift * lift * (3.0 - 2.0 * lift);
  vec3 drift = vec3(
    sin(uTime * 0.53 + seed * 31.0),
    0.4 + 0.6 * sin(uTime * 0.41 + seed * 17.0),
    cos(uTime * 0.47 + seed * 23.0)
  );
  return p + (dir * (1.0 + seed * 2.6) + vec3(0.0, 0.25 + seed * 0.9, 0.0) + drift * 0.5) * lift;
}

vec4 placePoint(vec3 p, out float dist, out float touch, out float quiet) {
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  dist = -mv.z;
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(clip.w, 0.001);
  vec2 delta = (ndc - uPointer) * vec2(uAspect, 1.0);
  float pd = length(delta);
  float near = 1.0 - smoothstep(0.0, 0.42, pd);
  touch = uPointerAmt * near * near;
  ndc += (delta / max(pd, 0.0001)) / vec2(uAspect, 1.0) * touch * 0.14;
  clip.xy = ndc * clip.w;
  vec2 q = max(uQuiet.xy - ndc, ndc - uQuiet.zw);
  quiet = mix(uQuietDim, 1.0, smoothstep(0.0, 0.16, length(max(q, 0.0))));
  vec2 m = max(uName.xy - ndc, ndc - uName.zw);
  quiet *= mix(uNameDim, 1.0, smoothstep(0.0, 0.12, length(max(m, 0.0))));
  return clip;
}
`;

const TURN = /* glsl */ `
vec2 turn(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
`;

/**
 * The light: white coffee blossoms on the plants and the soil's dim glints
 * that give the hills their shape. Each grows as the camera nears it, fades
 * into the dark with distance, and goes soft (and out) when very near.
 */
export const FIELD_VERTEX = /* glsl */ `
attribute float aKind;
attribute float aSize;
attribute float aRot;
attribute float aSeed;
attribute vec3 aDir;
${PLACE}
varying float vKind;
varying float vRot;
varying float vAlpha;
varying float vGlow;
varying float vMorph;
varying float vBlur;

void main() {
  vec3 p = position;
  float flower = step(0.5, aKind);
  // A breath of night air through the blossoms.
  p.x += sin(uTime * 0.7 + aSeed * 37.0 + p.z * 0.2) * 0.035 * flower;
  p.y += sin(uTime * 0.9 + aSeed * 53.0) * 0.02 * flower;
  float lift;
  p = liftOff(p, aDir, aSeed, lift);
  float dist;
  float touch;
  float quiet;
  gl_Position = placePoint(p, dist, touch, quiet);

  float grow = mix(0.3, 1.0, smoothstep(34.0, 5.0, dist));
  float size = aSize * grow * uPxScale / max(dist, 0.1);
  size *= 1.0 + touch * 0.55 + lift * 0.15;
  float nearFade = smoothstep(0.9, 2.6, dist);
  float fog = 1.0 - smoothstep(14.0, 56.0, dist);
  float sub = clamp(size / 1.6, 0.0, 1.0);

  vAlpha = nearFade * fog * quiet * sub * (1.0 + touch * 1.3);
  vGlow = touch;
  vMorph = lift;
  vKind = aKind;
  vRot = aRot + uTime * 0.06 * (aSeed - 0.5);
  vBlur = 1.0 - smoothstep(1.8, 5.5, dist);
  gl_PointSize = clamp(size, 1.0, uMaxPoint);
}
`;

export const FIELD_FRAGMENT = /* glsl */ `
uniform vec3 uBlossom;
uniform vec3 uHeart;
uniform vec3 uDust;
varying float vKind;
varying float vRot;
varying float vAlpha;
varying float vGlow;
varying float vMorph;
varying float vBlur;
${TURN}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 col;
  float a;
  if (vKind < 0.5) {
    // The soil's glints: a soft, dim round light.
    a = exp(-r * r * 5.0) * 0.7;
    col = uDust;
  } else {
    // A coffee blossom: five long oval petals, jasmine-like, round a pale
    // green heart. Each petal is an ellipse along its own axis.
    vec2 q = turn(p, vRot);
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
  }
  // Lifted off the plant, every blossom becomes a floating glow.
  float orb = exp(-r * r * 6.0);
  a = mix(a, orb * 0.85, vMorph);
  col += vGlow * 0.22;
  a *= vAlpha * (1.0 - vBlur * 0.35);
  gl_FragColor = vec4(col * a, a);
}
`;

/**
 * The things: green leaves on the plants, bordo cherries among them, and
 * roasted beans - on the ground, and (`aAir`) falling slowly through the air
 * round the camera, wrapped in a box that travels with it, each tumbling
 * about its long axis (`aSpin`). Drawn in true colour, normal-blended.
 */
export const SOLID_VERTEX = /* glsl */ `
attribute float aKind;
attribute float aAir;
attribute float aSize;
attribute float aRot;
attribute float aSeed;
attribute float aSpin;
attribute vec3 aDir;
uniform vec3 uCam;
uniform vec3 uBox;
${PLACE}
varying float vKind;
varying float vRot;
varying float vAlpha;
varying float vGlow;
varying float vBlur;
varying float vTumble;

void main() {
  vec3 p = position;
  float t = uTime;
  float edgeFade = 1.0;
  if (aAir > 0.5) {
    vec3 q = position * uBox + vec3(
      sin(t * 0.13 + aSeed * 20.0) * 0.9,
      -t * (0.1 + aSeed * 0.16),
      cos(t * 0.11 + aSeed * 13.0) * 0.9
    );
    vec3 rel = mod(q - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 edge = abs(rel) / (uBox * 0.5);
    edgeFade = 1.0 - smoothstep(0.72, 1.0, max(edge.x, max(edge.y, edge.z)));
    p = uCam + rel;
  } else if (aKind < 0.5) {
    // Leaves stir a little.
    p.x += sin(t * 0.6 + aSeed * 29.0 + p.z * 0.2) * 0.025;
  }
  float lift;
  p = liftOff(p, aDir, aSeed, lift);
  float dist;
  float touch;
  float quiet;
  gl_Position = placePoint(p, dist, touch, quiet);

  // On the ground a thing grows as the camera nears it; in the air it is
  // simply as large as it is.
  float grow = aAir > 0.5 ? 1.0 : mix(0.3, 1.0, smoothstep(34.0, 5.0, dist));
  float size = aSize * grow * uPxScale / max(dist, 0.1);
  size *= 1.0 + touch * 0.45;
  float nearFade = aAir > 0.5 ? smoothstep(0.45, 1.3, dist) : smoothstep(0.9, 2.6, dist);
  float fog = 1.0 - smoothstep(16.0, 58.0, dist);
  float sub = clamp(size / 1.6, 0.0, 1.0);

  vAlpha = nearFade * fog * quiet * sub * edgeFade;
  vGlow = touch;
  vKind = aKind;
  vRot = aRot + t * 0.05 * (aSeed - 0.5) * aAir;
  vTumble = aRot * 2.3 + t * aSpin;
  vBlur = 1.0 - smoothstep(1.6, 5.0, dist);
  gl_PointSize = clamp(size, 1.0, uMaxPoint);
}
`;

/**
 * `PASS` 0 is the opaque core (alpha over 0.62, writes depth), `PASS` 1 the
 * soft fringe and everything translucent - far things in the fog, near
 * things out of focus - blended over it.
 */
export const SOLID_FRAGMENT = /* glsl */ `
uniform vec3 uBean;
uniform vec3 uGlint;
uniform vec3 uShine;
uniform vec3 uRim;
uniform vec3 uCherry;
uniform vec3 uCherryLight;
uniform vec3 uLeaf;
uniform vec3 uLeafLight;
varying float vKind;
varying float vRot;
varying float vAlpha;
varying float vGlow;
varying float vBlur;
varying float vTumble;
${TURN}
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  if (length(p) > 1.0) discard;
  vec2 q = turn(p, vRot);
  float soft = 0.05 + vBlur * 0.5;
  vec3 col;
  float a;

  if (vKind < 0.5) {
    // A coffee leaf: long, pointed, gently bent, glossy on one side, a pale
    // midrib down the middle.
    vec2 l = q;
    l.x -= 0.1 * (l.y * l.y - 0.3);
    float halfW = 0.3 * pow(max(1.0 - l.y * l.y / 0.88, 0.0), 0.75);
    float edge = abs(l.x) - halfW;
    a = (1.0 - smoothstep(-soft, soft * 0.4 + 0.01, edge)) * step(abs(l.y), 0.94);
    float side = l.x / max(halfW, 0.001);
    col = uLeaf * (0.62 + 0.5 * (0.5 + 0.5 * side));
    col += uLeafLight * pow(max(0.0, 1.0 - abs(side - 0.4)), 5.0) * 0.16;
    float rib = 1.0 - smoothstep(0.012, 0.04, abs(l.x));
    col = mix(col, uLeafLight * 0.55, rib * 0.35);
  } else if (vKind < 1.5) {
    // A ripe cherry: deep bordo, round, one highlight.
    float r = length(p);
    a = 1.0 - smoothstep(0.52 - soft, 0.56 + soft * 0.3, r);
    vec3 n = normalize(vec3(p / 0.56, sqrt(max(1.0 - dot(p, p) / 0.3136, 0.0))));
    float lit = 0.55 + 0.6 * max(dot(n, normalize(vec3(-0.4, 0.5, 0.75))), 0.0);
    float hi = pow(max(dot(n, normalize(vec3(-0.35, 0.45, 0.82))), 0.0), 26.0);
    col = uCherry * lit + uCherryLight * hi * 0.85;
  } else {
    // A roasted bean, tumbling about its long axis: edge-on it is a slim
    // oval, face-on it shows the crease down its flat side; the light and
    // its glossy highlight travel across it as it turns. A bordo rim from
    // the horizon, and the brass only as the smallest glint.
    float c = cos(vTumble);
    float s = sin(vTumble);
    float w = max(abs(c), 0.24);
    vec2 e = q / vec2(0.43 * w, 0.64);
    float er = length(e);
    a = 1.0 - smoothstep(1.0 - soft * 1.6, 1.0 + soft * 0.4, er);
    vec3 n = normalize(vec3(e.x, e.y * 0.8, sqrt(max(1.0 - er * er, 0.0))));
    vec3 light = normalize(vec3(-0.45 + 0.55 * s, 0.55, 0.7));
    float lit = 0.4 + 0.85 * max(dot(n, light), 0.0);
    float face = smoothstep(0.1, 0.5, c);
    float crease = (1.0 - smoothstep(0.035 * w, 0.085 * w, abs(q.x - 0.07 * w * sin(q.y * 5.5))))
      * (1.0 - smoothstep(0.42, 0.6, abs(q.y))) * face;
    float shine = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 20.0);
    float glint = pow(shine, 4.0);
    float rim = pow(1.0 - n.z, 3.0);
    col = uBean * lit * (1.0 - crease * 0.72);
    col += uShine * shine * 0.55 + uGlint * glint * 0.5 + uRim * rim * 0.5;
  }

  col += vGlow * 0.15;
  a *= vAlpha;
#if PASS == 0
  if (a < 0.62) discard;
  gl_FragColor = vec4(col, 1.0);
#else
  if (a >= 0.62 || a < 0.004) discard;
  gl_FragColor = vec4(col * a, a);
#endif
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
  vAlpha = fade * twinkle * smoothstep(0.6, 2.0, dist) * clamp(size / 1.5, 0.0, 1.0) * 0.5;
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
