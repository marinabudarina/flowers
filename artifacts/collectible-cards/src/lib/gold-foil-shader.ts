// Gold foil fragment shader: glyph mask -> shallow edge relief + stable micro-crinkle normals,
// reflected into a virtual studio (softbox, strip light, bounce) plus a pointer lamp.
export const FOIL_VERT = `
attribute vec2 p;
varying vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }
`;

export const FOIL_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;   // r: sharp glyph alpha, g: blurred (relief height)
uniform vec2 uRes;         // canvas px
uniform vec3 uLightPosition; // same card-space light source as the flowers
uniform float uLightRadius;
uniform vec4 uWordRect;    // canvas bounds in card-space units, y up
uniform vec2 uTilt;        // card tilt -1..1
uniform float uGrain;      // micro-crinkle strength
uniform float uRelief;     // mask edge relief strength
uniform float uLamp;       // pointer lamp intensity
uniform float uDark;       // 1 on dark card theme

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
// crinkled leaf: ridged multi-octave noise, anisotropic, fixed in surface space
float crinkle(vec2 p){
  float h = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for(int i = 0; i < 4; i++){
    h += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
    p = r * p * 2.07 + 11.3; a *= 0.5;
  }
  return h;
}
float height(vec2 uv){
  vec2 px = uv * uRes;
  vec4 m = texture2D(uMask, uv);
  return m.g * uRelief + crinkle(px / 9.0) * uGrain * (0.35 + 0.65 * m.r);
}
// virtual studio radiance for a reflected direction (y up, z toward viewer)
vec3 studio(vec3 r, vec3 lampDirection){
  vec3 c = vec3(0.05);
  // A faint, fixed studio remains behind the cursor-driven softbox.
  vec2 sb = vec2(r.x + 0.45, r.y - 0.55);
  c += vec3(1.0, 0.96, 0.86) * 0.16 * (1.0 - smoothstep(0.15, 0.55, length(sb * vec2(0.9, 1.3))));
  // Reflect the actual shared source, not a stationary gold-colored fill.
  // Its broad face and brighter strip cross the microfacets as it moves.
  vec2 q = r.xy - lampDirection.xy;
  float face = exp(-dot(q / vec2(0.24, 0.28), q / vec2(0.24, 0.28)));
  float strip = exp(-pow((q.x + 0.17) / 0.055, 2.0))
    * (1.0 - smoothstep(0.18, 0.55, abs(q.y)));
  c += vec3(1.0, 0.96, 0.84) * (face * 2.6 + strip * 1.4);
  c += vec3(0.55, 0.38, 0.16) * 0.12 * (1.0 - smoothstep(-0.75, -0.1, r.y));
  return c;
}
void main(){
  vec4 m = texture2D(uMask, vUv);
  if(m.r < 0.003) discard;
  vec2 e = 1.0 / uRes;
  float h0 = height(vUv);
  float hx = height(vUv + vec2(e.x, 0.0)) - h0;
  float hy = height(vUv + vec2(0.0, e.y)) - h0;
  vec3 n = normalize(vec3(-hx * 3.0, -hy * 3.0, 1.0));
  // tilt rotates the surface relative to the fixed studio
  n = normalize(n + vec3(uTilt.x * 0.35, -uTilt.y * 0.3, 0.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  // The broad reflection sees the average sheet normal; individual crinkles
  // still supply sharp glints below. Using full bevel slopes for both spread
  // highlights over every direction and made the overall word stay constant.
  vec3 sheetNormal = normalize(vec3(-hx * 0.35, -hy * 0.35, 1.0)
    + vec3(uTilt.x * 0.08, -uTilt.y * 0.08, 0.0));
  vec3 r = reflect(-v, sheetNormal);
  vec3 surface = vec3(uWordRect.xy + vUv * uWordRect.zw, 0.0);
  vec3 env = studio(r, normalize(uLightPosition - surface));

  // gold: reflectance tints everything (metal, no diffuse white)
  vec3 deep = vec3(0.42, 0.26, 0.06);
  vec3 gold = vec3(0.86, 0.62, 0.20);
  vec3 pale = vec3(1.0, 0.88, 0.55);
  float L = dot(env, vec3(0.333));
  vec3 col = mix(deep, gold, smoothstep(0.08, 0.9, L));
  col = mix(col, pale, smoothstep(1.0, 2.4, L));
  float caught = smoothstep(0.15, 1.9, L);
  col *= 0.45 + caught * 0.65;

  // The same broad, five-sample softbox used by the flowers. No word-local
  // distance cutoff: light on either side of the card reaches BOTH materials.
  float specular = 0.0, broad = 0.0, illumination = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 offset = vec2(0.0);
    if (i == 1) offset.x = -1.0;
    if (i == 2) offset.x = 1.0;
    if (i == 3) offset.y = -1.0;
    if (i == 4) offset.y = 1.0;
    float weight = i == 0 ? 0.4 : 0.15;
    vec3 delta = uLightPosition + vec3(offset * uLightRadius, 0.0) - surface;
    vec3 ld = normalize(delta);
    float nh = max(dot(n, normalize(ld + v)), 0.0);
    float fall = uLightPosition.z * uLightPosition.z / max(dot(delta, delta), 1.0);
    specular += weight * pow(nh, 100.0) * fall;
    broad += weight * pow(nh, 8.0) * fall;
    illumination += weight * max(dot(n, ld), 0.0) * fall;
  }
  col += vec3(1.0, 0.9, 0.62) * uLamp * (specular * 0.7 + broad * 0.08);
  col += gold * 0.04 * uLamp * illumination;

  // fine edge darkening (stamp wall) to keep the glyph crisp on ivory
  float edge = smoothstep(0.0, 0.5, m.g);
  col *= mix(0.62, 1.0, edge);
  col = mix(col, col * 1.1, uDark);
  // Smooth exposure preserves differences between bright reflections instead
  // of clipping a broad range of cursor positions to the same flat highlight.
  col = vec3(1.0) - exp(-col * 1.55);
  gl_FragColor = vec4(col * m.r, m.r);
}
`;
