/* Cinematic Clinic — APERTURE.
   The home page is one idea: you look through a lens. An iris opens on the first
   film; scrolling travels through a reel of Shahab's films hanging in the dark,
   each one lighting the room in its own colour; the focused film plays; the iris
   closes at the end. Everything else on the page gets out of the way.

   v2 (next level): the room is alive — the camera breathes and leans toward the
   mouse, dust hangs in the projector light, every film stands on a dark mirror,
   frames soften while travelling and land with a light leak, scope films are
   matted to their real width, and a viewfinder with the film's own timecode
   locks onto whatever is in focus.

   Built on three.js, bundled with esbuild into static/aperture.js. The page is
   complete without it: no WebGL, reduced motion or Save-Data → the static reel
   (a plain grid of the same films) stays, and every film still plays on click. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, Mesh, PlaneGeometry,
  ShaderMaterial, TextureLoader, VideoTexture, Color, Vector2, Vector3, Raycaster,
  AdditiveBlending, LinearFilter, ColorManagement, LinearSRGBColorSpace, NoColorSpace,
  BufferGeometry, BufferAttribute, Points,
} from 'three';

ColorManagement.enabled = false; // colours in, colours out — everything here is authored in sRGB

const root = document.querySelector('[data-aperture]');
if (root) boot(root);

function boot(root) {
  const cfg = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
  const films = cfg.films;
  const N = films.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const conn = navigator.connection || {};
  const slowNet = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const cinema = setupCinema(root, cfg);
  if (!reduce && finePointer) setupPeek();

  // Static mode keeps the grid: it is the page for anyone the scene would fail.
  const canvas = root.querySelector('.ap-canvas');
  let renderer;
  if (!reduce && !slowNet && canvas) {
    try { renderer = new WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, alpha: false, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  }
  root.querySelectorAll('[data-ap-play]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); cinema.open(+b.getAttribute('data-ap-play')); }));
  if (!renderer) { root.classList.add('ap-static'); return; }
  root.classList.add('ap-live');
  renderer.outputColorSpace = LinearSRGBColorSpace;

  // ---------------------------------------------------------------- layout
  const mobile = () => innerWidth < 760;
  const SIZE = { h: [1.78, 1.0], v: [0.64, 1.14] };
  const GAP = 3.6;
  const layout = films.map((f, i) => {
    const [w, h] = SIZE[f.orient] || SIZE.h;
    // a slow S through the dark: never a straight corridor, never a slideshow
    const x = Math.sin(i * 1.25) * (f.orient === 'v' ? 0.62 : 0.34);
    const y = Math.cos(i * 0.83) * 0.1;
    // h0 is the full frame; h follows the matte when a scope film is cropped to its real width
    return { w, h, h0: h, hTarget: h, pos: new Vector3(x, y, -i * GAP), rotY: -x * 0.16 };
  });

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 120);
  const bg = new Color(0.03, 0.03, 0.034);
  const bgTarget = new Color().copy(bg);
  scene.background = bg;

  // ---------------------------------------------------------------- film planes
  const vert = /* glsl */`
    uniform float uVelocity; uniform float uTime; uniform float uFocus;
    varying vec2 vUv; varying float vDepth;
    void main() {
      vUv = uv;
      vec3 p = position;
      // the frame bends like film running through a gate when you move fast
      p.z -= sin(uv.x * 3.14159265) * uVelocity * 0.22;
      p.z += sin(uv.y * 3.14159265 + uTime * 0.7) * 0.012 * (1.0 - uFocus);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const frag = /* glsl */`
    uniform sampler2D uMap; uniform float uReady; uniform float uFocus; uniform float uVelocity;
    uniform vec3 uBg; uniform float uFogNear; uniform float uFogFar; uniform float uTime; uniform float uGone;
    uniform float uBlur; uniform float uFlash; uniform vec2 uSize; uniform vec2 uCrop;
    varying vec2 vUv; varying float vDepth;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 tex(vec2 uv) { return texture2D(uMap, uv).rgb; }
    void main() {
      vec2 uv = vec2(vUv.x, uCrop.x + vUv.y * uCrop.y);        // the matte: scope films shown at their real width
      // focus pull: soft while travelling, sharp on arrival
      float r = uBlur;
      vec3 c = tex(uv) * 0.4
             + (tex(uv + vec2(r, 0.0)) + tex(uv - vec2(r, 0.0)) + tex(uv + vec2(0.0, r * 1.7)) + tex(uv - vec2(0.0, r * 1.7))) * 0.15;
      float s = uVelocity * 0.006;                               // the colour splits a little at speed
      c.r = mix(c.r, texture2D(uMap, uv + vec2(s, 0.0)).r, 0.7);
      c.b = mix(c.b, texture2D(uMap, uv - vec2(s, 0.0)).b, 0.7);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l) * 0.85, c, 0.4 + 0.6 * uFocus);          // frames at rest sink toward monochrome
      c *= 0.55 + 0.45 * uFocus;
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * 0.6;                                // lens vignette in every frame
      // light leak: a warm band crosses the frame as it lands
      float band = exp(-pow((vUv.x + (1.0 - vUv.y) * 0.35 - (1.45 - uFlash * 1.9)) * 3.0, 2.0));
      c += vec3(1.0, 0.6, 0.3) * band * uFlash * 0.5 + vec3(1.0, 0.9, 0.8) * uFlash * uFlash * 0.06;
      c += (hash(vUv * 811.0 + fract(uTime)) - 0.5) * 0.05;    // grain
      c = mix(uBg * 1.6 + 0.02, c, uReady);                      // an unloaded frame is a dim slate, not a hole
      // a waiting frame catches the light on its edge: a screen, not a grey box
      vec2 e = min(vUv, 1.0 - vUv) * uSize;
      float rim = 1.0 - smoothstep(0.0, 0.008, min(e.x, e.y));
      c += vec3(0.95, 0.9, 0.84) * rim * 0.3 * (1.0 - uFocus);
      c = mix(c, uBg, smoothstep(uFogNear, uFogFar, vDepth));
      // a frame the camera is about to pass through dissolves instead of filling the lens
      float a = smoothstep(0.55, 1.7, vDepth) * (1.0 - uGone);   // …and a film already watched steps aside
      if (a < 0.01) discard;
      gl_FragColor = vec4(c, a);
    }`;
  // the dark mirror under every film: the image flipped, blurred and fading into the floor
  const reflFrag = /* glsl */`
    uniform sampler2D uMap; uniform float uReady; uniform float uFocus; uniform vec3 uBg;
    uniform float uFogNear; uniform float uFogFar; uniform float uGone; uniform float uAmt; uniform vec2 uCrop;
    varying vec2 vUv; varying float vDepth;
    vec3 tex(vec2 uv) { return texture2D(uMap, uv).rgb; }
    void main() {
      float y = 1.0 - vUv.y;                                     // 0 at the floor line, 1 far below it
      vec2 uv = vec2(vUv.x, uCrop.x + y * uCrop.y);              // mirrored: the film's bottom row sits on the floor line
      float r = 0.004 + y * 0.03;                                // the further from the film, the softer
      vec3 c = (tex(uv) + tex(uv + vec2(r, 0.0)) + tex(uv - vec2(r, 0.0)) + tex(uv + vec2(0.0, r)) + tex(uv - vec2(0.0, r))) * 0.2;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.6) * (0.55 + 0.45 * uFocus);
      float a = uAmt * pow(1.0 - y, 2.6) * uReady * (1.0 - uGone) * smoothstep(0.55, 1.7, vDepth);
      c = mix(c, uBg, smoothstep(uFogNear, uFogFar, vDepth));
      if (a < 0.004) discard;
      gl_FragColor = vec4(c, a);
    }`;
  const blank = new Color(0, 0, 0);
  const geoH = new PlaneGeometry(1, 1, 24, 6);
  const FLOOR_GAP = 0.035;
  const planes = films.map((f, i) => {
    const L = layout[i];
    const mat = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: {
        uMap: { value: null }, uReady: { value: 0 }, uFocus: { value: 0 }, uVelocity: { value: 0 },
        uBg: { value: bg }, uFogNear: { value: 5 }, uFogFar: { value: 16 }, uTime: { value: 0 }, uGone: { value: 0 },
        uBlur: { value: 0 }, uFlash: { value: 0 }, uSize: { value: new Vector2(L.w, L.h) }, uCrop: { value: new Vector2(0, 1) },
      },
    });
    const m = new Mesh(geoH, mat);
    m.scale.set(L.w, L.h, 1);
    m.position.copy(L.pos);
    m.rotation.y = L.rotY;
    const rmat = new ShaderMaterial({
      vertexShader: vert, fragmentShader: reflFrag, transparent: true, depthWrite: false,
      uniforms: {
        uMap: { value: null }, uReady: { value: 0 }, uFocus: { value: 0 }, uVelocity: { value: 0 }, uTime: { value: 0 },
        uBg: { value: bg }, uFogNear: { value: 5 }, uFogFar: { value: 16 }, uGone: { value: 0 }, uAmt: { value: 0.15 },
        uCrop: mat.uniforms.uCrop,
      },
    });
    const refl = new Mesh(geoH, rmat);
    refl.rotation.y = L.rotY;
    scene.add(refl);
    m.userData = { i, mood: blank.clone(), poster: null, video: null, vtex: null, ready: 0, refl, cropPoster: 0, cropVideo: 0 };
    scene.add(m);
    return m;
  });
  function placeFrame(m) {
    const L = layout[m.userData.i];
    m.scale.set(L.w, L.h, 1);
    m.material.uniforms.uSize.value.set(L.w, L.h);
    const bottom = L.pos.y - L.h / 2 - FLOOR_GAP;
    const r = m.userData.refl;
    r.scale.set(L.w, L.h, 1);
    r.position.set(L.pos.x, bottom - L.h / 2 - FLOOR_GAP, L.pos.z);
  }
  planes.forEach(placeFrame);

  // the light a lit screen throws into a dark room
  const glow = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color(0.2, 0.18, 0.16) }, uAmt: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAmt; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(1.0 - d, 0.0), 2.4) * uAmt; gl_FragColor = vec4(uColor * a, 1.0); }',
  }));
  glow.scale.set(9, 6, 1);
  scene.add(glow);

  // dust in the projector light: fine specks that drift, lit by the film in focus
  const DUST = mobile() ? 240 : 520, DEPTH = 9;
  const dustGeo = new BufferGeometry();
  const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
  for (let k = 0; k < DUST; k++) {
    dp[k * 3] = (Math.random() - 0.5) * 6.4;
    dp[k * 3 + 1] = (Math.random() - 0.5) * 3.4;
    dp[k * 3 + 2] = Math.random() * DEPTH;
    ds[k] = Math.random();
  }
  dustGeo.setAttribute('position', new BufferAttribute(dp, 3));
  dustGeo.setAttribute('seed', new BufferAttribute(ds, 1));
  const dust = new Points(dustGeo, new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCamZ: { value: 0 }, uColor: { value: new Color(0.5, 0.45, 0.4) }, uFilm: { value: new Vector3() }, uAmt: { value: 0 }, uPx: { value: 1 }, uH: { value: 900 } },
    vertexShader: /* glsl */`
      attribute float seed;
      uniform float uTime; uniform float uCamZ; uniform vec3 uFilm; uniform float uAmt; uniform float uPx; uniform float uH;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime;
        p.x += sin(t * 0.13 + seed * 6.283) * 0.14;
        p.y += sin(t * 0.11 + seed * 4.1) * 0.1 + fract(t * 0.004 * (0.3 + seed)) * 0.6 - 0.3;
        p.z = uCamZ - 0.35 - mod(uCamZ - position.z, ${DEPTH.toFixed(1)});
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.006 + seed * 0.012) * uPx * uH / max(-mv.z, 0.2);
        float beam = exp(-pow(length(p.xy - uFilm.xy) / 1.15, 2.0));
        vA = uAmt * (0.18 + 0.82 * beam) * smoothstep(0.25, 1.1, -mv.z) * (0.55 + 0.45 * sin(t * 0.8 + seed * 40.0));
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------------- iris
  const iris = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uOpen: { value: 0 }, uAspect: { value: innerWidth / innerHeight }, uTint: { value: new Color(0.3, 0.26, 0.22) }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uOpen; uniform float uAspect; uniform vec3 uTint; uniform float uTime; varying vec2 vUv;
      #define N 9.0
      #define PI 3.14159265
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
        float r = length(p), a = atan(p.y, p.x);
        float maxR = length(vec2(uAspect, 1.0)) * 1.12;
        float R = mix(0.012, maxR, uOpen);
        float rot = (1.0 - uOpen) * 1.05;                   // blades turn as they open
        float sector = 2.0 * PI / N;
        float la = mod(a - rot + sector * 0.5, sector) - sector * 0.5;
        float edge = mix(R * cos(PI / N) / cos(la), R * 0.97, 0.32);   // bowed polygon, like real blades
        float aa = 1.5 / 900.0 * (1.0 + r);
        float inside = smoothstep(edge + aa, edge - aa, r);
        float sp = a - rot + log(max(r, 1e-3)) * 0.9;          // log-spiral: the overlap lines of the blades
        float bi = floor(sp / sector), bf = fract(sp / sector);
        float seam = smoothstep(0.0, 0.03, bf) * smoothstep(1.0, 0.97, bf);
        float shade = 0.55 + 0.45 * sin(bi * 2.39996 + 1.3);
        float brushed = 0.93 + 0.07 * sin(r * 210.0 + bi * 3.0);
        vec3 metal = vec3(0.068, 0.07, 0.078) * shade * brushed + uTint * 0.045 * shade;
        metal *= 0.2 + 0.8 * seam;
        float rim = smoothstep(0.022, 0.0, abs(r - edge)) * (1.0 - inside);
        metal += vec3(1.0, 0.92, 0.84) * rim * 0.3 * (0.55 + 0.45 * shade);
        metal *= 1.0 - smoothstep(maxR * 0.35, maxR * 1.25, r) * 0.55;
        gl_FragColor = vec4(metal, 1.0 - inside);
      }`,
  }));
  iris.frustumCulled = false;
  iris.renderOrder = 10;
  const irisScene = new Scene();
  irisScene.add(iris);
  const irisCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------------------------------------------------------------- media
  const loader = new TextureLoader();
  loader.setCrossOrigin('anonymous');
  const src = (p) => (/^(https?:)?\//.test(p) ? p : cfg.base + p);
  function loadPoster(m) {
    if (m.userData.poster) return;
    const f = films[m.userData.i];
    m.userData.poster = 'loading';
    loader.load(src(f.poster), (t) => {
      t.colorSpace = NoColorSpace; t.minFilter = LinearFilter; t.generateMipmaps = false;
      m.userData.poster = t;
      m.userData.cropPoster = f.orient === 'v' ? 0 : letterbox(t.image) || 0;
      if (!m.userData.vtex) { bind(m, t, m.userData.cropPoster); }
      m.userData.ready = 1;
      m.userData.mood.copy(moodOf(t.image));
      if (m.userData.i === 0) firstFrame();
    }, undefined, () => { m.userData.poster = 'failed'; });   // a missing still stays a slate; never retried in a loop
  }
  function dropPoster(m) {
    const u = m.userData;
    if (!u.poster || typeof u.poster === 'string' || u.video) return;
    if (m.material.uniforms.uMap.value === u.poster) bind(m, null, 0);
    u.poster.dispose(); u.poster = null; u.ready = 0;
  }
  // put a picture on a frame, with its matte
  function bind(m, t, crop) {
    m.material.uniforms.uMap.value = t;
    m.userData.refl.material.uniforms.uMap.value = t;
    m.material.uniforms.uCrop.value.set(crop, 1 - 2 * crop);
    const L = layout[m.userData.i];
    L.hTarget = L.h0 * (1 - 2 * crop);
  }
  // the average colour of a still, pushed down into shadow: the room's light
  const probe = document.createElement('canvas'); probe.width = probe.height = 8;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const hsl = { h: 0, s: 0, l: 0 };
  function moodOf(img) {
    try {
      pctx.drawImage(img, 0, 0, 8, 8);
      const d = pctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      const n = d.length / 4 * 255;
      // the room takes the film's hue, deeper and more saturated than the average pixel
      const c = new Color(r / n, g / n, b / n);
      c.getHSL(hsl);
      return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.6 + 0.08), Math.min(0.5, hsl.l * 0.9 + 0.05));
    } catch (e) { return new Color(0.2, 0.2, 0.2); }
  }
  // Scope films arrive letterboxed inside 16:9. Black bars top and bottom, the same on both
  // sides, with a lit picture between them → the fraction to matte away on each side.
  const lbc = document.createElement('canvas'); lbc.width = 96; lbc.height = 54;
  const lbx = lbc.getContext('2d', { willReadFrequently: true });
  function letterbox(img) {
    try {
      lbx.drawImage(img, 0, 0, 96, 54);
      const d = lbx.getImageData(0, 0, 96, 54).data;
      const rowMax = (y) => { let mx = 0; for (let x = 0; x < 96; x++) { const o = (y * 96 + x) * 4; mx = Math.max(mx, (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255); } return mx; };
      if (rowMax(27) < 0.12) return 0;                          // a black frame says nothing
      let top = 0, bot = 0;
      while (top < 12 && rowMax(top) < 0.075) top++;
      while (bot < 12 && rowMax(53 - bot) < 0.075) bot++;
      if (top < 2 || bot < 2 || Math.abs(top - bot) > 2 || top >= 12 || bot >= 12) return 0;
      return Math.min(0.2, (Math.min(top, bot) + 0.35) / 54);
    } catch (e) { return 0; }
  }
  // Video per film, in three states: none; warm (metadata and one frame, so the film is
  // already there when you arrive); hot (buffering to play). The films are full-length
  // masters, so only the one in focus is allowed to stream.
  function wantVideo(m, level) {
    const u = m.userData;
    if (level > 0 && !u.video) {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous'; v.muted = true; v.defaultMuted = true; v.playsInline = true;
      v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      v.preload = level > 1 ? 'auto' : 'metadata';
      v.src = src(films[u.i].video);
      let swapped = false, checks = 0;
      // the still holds until a real frame from inside the film is ready — never a black first frame
      const swap = () => {
        if (swapped || u.video !== v || v.readyState < 2 || v.currentTime < 0.05) return;
        swapped = true;
        const t = new VideoTexture(v); t.colorSpace = NoColorSpace; t.minFilter = LinearFilter; t.generateMipmaps = false;
        t.needsUpdate = true;                                    // upload this frame now, not on the next video frame: no black blink
        u.vtex = t;
        u.cropVideo = films[u.i].orient === 'v' ? 0 : letterbox(v);
        bind(m, t, u.cropVideo);
        u.ready = 1;
        if (u.i === 0) firstFrame();
      };
      // the matte is measured again a moment in, in case the first frame was a fade
      const recheck = () => {
        if (!swapped || u.video !== v || films[u.i].orient === 'v' || ++checks > 3) return;
        const c = letterbox(v);
        if (c && Math.abs(c - u.cropVideo) > 0.01) { u.cropVideo = c; if (u.vtex) bind(m, u.vtex, c); }
      };
      // films open on titles or black: the loop starts a little in and never goes back to frame one
      const startAt = () => Math.min(2.5, (v.duration || 0) * 0.1);
      v.addEventListener('loadedmetadata', () => { try { v.currentTime = startAt(); } catch (e) {} }, { once: true });
      v.addEventListener('ended', () => { try { v.currentTime = startAt(); } catch (e) {} if (u.video === v && !v.paused) return; v.play().catch(() => {}); });
      v.addEventListener('seeked', swap);
      v.addEventListener('timeupdate', () => { swap(); if (swapped && v.currentTime > 4 + checks * 3) recheck(); });
      u.video = v;
    } else if (level === 0 && u.video) {
      const v = u.video; u.video = null;
      v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) {}
      if (u.vtex) { u.vtex.dispose(); u.vtex = null; }
      const still = u.poster && typeof u.poster === 'object' ? u.poster : null;
      bind(m, still, still ? u.cropPoster : 0);
      u.ready = still ? 1 : 0;
    }
    if (u.video && level > 1 && u.video.preload !== 'auto') u.video.preload = 'auto';
  }

  // ---------------------------------------------------------------- scroll → reel position
  const track = root.querySelector('.ap-track');
  let step = 1, tail = 1, trackTop = 0, target = 0, pos = 0, prevPos = 0, vel = 0, tailP = 0;
  function measure() {
    const r = track.getBoundingClientRect();
    trackTop = r.top + scrollY;
    step = innerHeight * (mobile() ? 0.7 : 0.8);
    tail = innerHeight * 0.9;
  }
  function readScroll() {
    const s = scrollY - trackTop;
    target = Math.min(Math.max(s / step, 0), N - 1);
    tailP = Math.min(Math.max((s - (N - 1) * step) / tail, 0), 1);
  }
  // A programmatic move (keys, rail, click, snap) holds the snap off until the reel has
  // arrived, so a slow frame can never pull it back to where it started. A wheel or a
  // touch hands control straight back to the reader.
  let lastScroll = 0, navUntil = 0, navTo = -1;
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  ['wheel', 'touchstart'].forEach((ev) => addEventListener(ev, () => { navUntil = 0; }, { passive: true }));
  function maybeSnap(now) {
    if (reduce || cinema.isOpen() || now - lastScroll < 260) return;
    if (now < navUntil) { if (Math.abs(target - navTo) > 0.01) return; navUntil = 0; }
    const s = scrollY - trackTop;
    if (s <= 0 || s >= (N - 1) * step) return;
    const nearest = Math.round(target);
    if (Math.abs(target - nearest) < 0.012) return;
    scrollToFilm(nearest);
  }
  function scrollToFilm(i, instant) {
    navTo = i; navUntil = performance.now() + 2500;
    scrollTo({ top: trackTop + i * step, behavior: instant || reduce ? 'instant' : 'smooth' });
  }

  // ---------------------------------------------------------------- UI
  const ui = {
    count: root.querySelector('.ap-count'),
    title: root.querySelector('.ap-title'),
    meta: root.querySelector('.ap-meta'),
    caption: root.querySelector('.ap-caption'),
    hero: root.querySelector('.ap-hero'),
    rail: [...root.querySelectorAll('.ap-rail button')],
    watch: root.querySelector('.ap-watch'),
    vf: root.querySelector('.ap-vf'),
    tc: root.querySelector('.ap-vf-tc'),
    ar: root.querySelector('.ap-vf-ar'),
  };
  const pad = (n) => String(n).padStart(2, '0');
  const digits = (s) => (cfg.lang === 'fa' ? String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // the title arrives letter by letter (word by word in Persian, where letters join)
  function lettered(text) {
    if (cfg.lang === 'fa') return text.split(' ').map((w, k) => `<span class="ch" style="--i:${k * 3}">${esc(w)}</span>`).join(' ');
    let k = 0;
    return text.split(' ').map((w) => `<span class="wd">${[...w].map((c) => `<span class="ch" style="--i:${k++}">${esc(c)}</span>`).join('')}</span>`).join(' ');
  }
  let shown = -1;
  function showCaption(i) {
    if (i === shown) return;
    shown = i;
    const f = films[i];
    ui.caption.classList.remove('is-in');
    clearTimeout(showCaption.t);
    showCaption.t = setTimeout(() => {
      ui.count.innerHTML = `<span class="ap-num"><span>${digits(pad(i + 1))}</span></span> / ${digits(pad(N))}`;
      ui.title.innerHTML = lettered(f.title);
      ui.title.setAttribute('aria-label', f.title);
      ui.meta.textContent = `${f.client} · ${f.cat}`;
      ui.watch.setAttribute('data-ap-play', i);
      ui.watch.setAttribute('aria-label', `${cfg.ui.watch} — ${f.title}, ${f.client}`);
      if (ui.ar) ui.ar.textContent = f.orient === 'v' ? '9:16' : '16:9';
      ui.caption.classList.add('is-in');
    }, 180);
    ui.rail.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  }
  ui.rail.forEach((b, k) => b.addEventListener('click', () => scrollToFilm(k)));
  // (the watch button already opens the cinema through its data-ap-play handler above)

  // keyboard: the reel is a list, so arrows move along it
  addEventListener('keydown', (e) => {
    if (cinema.isOpen() || e.target.closest('input, textarea, select')) return;
    const inReel = scrollY >= trackTop - innerHeight * 0.5 && scrollY <= trackTop + (N - 1) * step + innerHeight * 0.3;
    if (!inReel) return;
    const i = performance.now() < navUntil && navTo >= 0 ? navTo : Math.round(target);
    if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key) && i < N - 1) { e.preventDefault(); scrollToFilm(i + 1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key) && i > 0) { e.preventDefault(); scrollToFilm(i - 1); }
  });

  // pointer: hover the focused film to watch it; click another to travel to it
  const ray = new Raycaster(), mouse = new Vector2(2, 2);
  const lean = new Vector2(), leanTo = new Vector2();   // the camera leans toward the pointer
  let hoverIdx = -1;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  canvas.addEventListener('pointerleave', () => mouse.set(2, 2));
  if (finePointer) addEventListener('pointermove', (e) => { leanTo.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1); }, { passive: true });
  canvas.addEventListener('click', () => {
    if (hoverIdx < 0) return;
    if (hoverIdx === Math.round(pos) && Math.abs(pos - hoverIdx) < 0.25) cinema.open(hoverIdx);
    else scrollToFilm(hoverIdx);
  });
  // the site cursor becomes a "Watch" disc over the film in focus
  let cursorOn = false;
  function watchCursor(on) {
    if (on === cursorOn) return;
    const c = document.querySelector('.cursor');
    if (!c) return;
    cursorOn = on;
    const l = c.querySelector('.cursor-label');
    if (on) { if (l) l.textContent = cfg.ui.cursor || cfg.ui.watch; c.classList.add('is-big', 'is-film'); c.classList.remove('is-link'); }
    else { if (l) l.textContent = ''; c.classList.remove('is-big', 'is-film'); }
  }

  // ---------------------------------------------------------------- intro
  let open = 0, openTarget = 0, started = false, t0 = 0;
  function firstFrame() {
    if (started) return;
    started = true;
    t0 = performance.now();
    root.classList.add('ap-ready');
    // after the entrance, the name tracks the scroll directly instead of easing
    setTimeout(() => root.classList.add('ap-moved'), 2600);
  }
  setTimeout(firstFrame, 2600); // never hold the page closed on a slow network

  // ---------------------------------------------------------------- frame loop
  let running = false, raf = 0, last = performance.now();
  const camPos = new Vector3(), look = new Vector3(), tmp = new Vector3(), corner = new Vector3();
  // Each film gets the distance that frames it: on a wide screen every film sits at the
  // same distance; on a phone the camera leans in for portrait films and eases back for
  // landscape ones, so each is as large as the screen allows.
  let Dfit = [];
  function fitAll() {
    const tan = Math.tan((camera.fov * Math.PI / 180) / 2);
    const tall = camera.aspect < 0.9;
    Dfit = layout.map((L) => Math.max(
      2.5,
      (L.w * 1.12) / (2 * tan * camera.aspect),        // the frame fits across, with a margin
      (L.h0 * (tall ? 1.72 : 1.32)) / (2 * tan),        // …and leaves room for the caption
    ));
  }
  fitAll();
  const lift = () => (camera.aspect < 0.9 ? 0.085 : 0); // on a phone the film rides above the caption
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const vf = { x: 0, y: 0, w: 0, h: 0, o: 0 };
  let landed = -1;

  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t = now / 1000;
    readScroll();
    maybeSnap(now);
    pos += (target - pos) * (1 - Math.pow(0.001, dt));      // critically damped glide
    vel += ((pos - prevPos) / Math.max(dt, 1e-3) * 0.12 - vel) * (1 - Math.pow(0.0005, dt));
    prevPos = pos;
    const v = Math.max(-1, Math.min(1, vel));
    lean.lerp(leanTo, 1 - Math.pow(0.02, dt));

    // mattes ease in, so a scope film settles into its width like a curtain closing to size
    layout.forEach((L, i) => { if (Math.abs(L.h - L.hTarget) > 0.0005) { L.h += (L.hTarget - L.h) * (1 - Math.pow(0.004, dt)); placeFrame(planes[i]); } });

    // camera rides a spline through the reel, looking at the frame it is nearest;
    // it breathes when it rests and leans toward the pointer
    const i0 = Math.floor(pos), i1 = Math.min(i0 + 1, N - 1), f = pos - i0;
    const a = layout[i0].pos, b = layout[i1].pos;
    camPos.lerpVectors(a, b, ease(f));
    const D = Dfit[i0] + (Dfit[i1] - Dfit[i0]) * ease(f);
    const dolly = ease(tailP) * (D - 1.75);                   // at the end the camera leans into the last film
    const up = lift() * 2 * D * Math.tan((camera.fov * Math.PI / 180) / 2);
    const breathe = 1 - Math.min(1, Math.abs(v) * 3);
    const bx = (Math.sin(t * 0.21) * 0.022 + Math.sin(t * 0.13 + 2.0) * 0.012) * breathe + lean.x * 0.13;
    const by = (Math.sin(t * 0.17 + 1.0) * 0.014) * breathe - lean.y * 0.075;
    camera.position.set(camPos.x * 0.85 + bx, camPos.y * 0.6 + 0.02 - up + by, camPos.z + D - dolly);
    look.lerpVectors(a, b, ease(f));
    camera.lookAt(look.x * 0.92 + bx * 0.35, look.y * 0.9 - up + by * 0.35, look.z);
    camera.rotation.z = -v * 0.02 + lean.x * -0.006;

    // focus, media and mood
    const near = Math.round(pos);
    const settled = Math.abs(pos - near) < 0.06;
    if (settled && landed !== near) { landed = near; planes[near].material.uniforms.uFlash.value = 1; }
    if (!settled && Math.abs(pos - landed) > 0.5) landed = -1;
    planes.forEach((m, i) => {
      const d = Math.abs(i - pos);
      const u = m.material.uniforms, ru = m.userData.refl.material.uniforms;
      u.uFocus.value += (Math.max(0, 1 - d * 1.35) - u.uFocus.value) * 0.12;
      u.uVelocity.value = v;
      u.uTime.value = t;
      u.uReady.value += (m.userData.ready - u.uReady.value) * 0.08;
      u.uBlur.value = Math.abs(v) * 0.011 + (1 - u.uFocus.value) * 0.0025;
      u.uFlash.value *= Math.pow(0.18, dt);
      // behind the camera: gone. On a phone the films still ahead wait in the dark too,
      // so the one in focus has the screen to itself.
      const passed = Math.min(Math.max((pos - i - 0.3) / 0.45, 0), 1);
      const ahead = camera.aspect < 0.9 ? Math.min(Math.max((i - pos - 0.3) / 0.6, 0), 1) * 0.85 : 0;
      u.uGone.value = Math.max(passed, ahead);
      u.uFogNear.value = D + 2.5; u.uFogFar.value = D + 13.5;
      ru.uFocus.value = u.uFocus.value; ru.uReady.value = u.uReady.value; ru.uGone.value = u.uGone.value;
      ru.uFogNear.value = D + 1.5; ru.uFogFar.value = D + 9;
      ru.uVelocity.value = v; ru.uTime.value = t;
      m.userData.refl.visible = d < 3.2;
      ru.uAmt.value = camera.aspect < 0.9 ? 0.07 : 0.15;
      if (d < 3.5) loadPoster(m);
      else if (d > 6.5) dropPoster(m);                        // phones have little GPU memory: keep only the stills nearby
      wantVideo(m, d < 0.6 ? 2 : d < (camera.aspect < 0.9 ? 1.1 : 1.6) ? 1 : 0);
      const vid = m.userData.video;
      if (vid) {
        if (i === near && !cinema.isOpen() && document.visibilityState === 'visible') { if (vid.paused) vid.play().catch(() => {}); }
        else if (!vid.paused) vid.pause();
      }
    });
    const mood = planes[near].userData.mood;
    bgTarget.setRGB(mood.r * 0.1 + 0.012, mood.g * 0.1 + 0.012, mood.b * 0.1 + 0.014);
    bg.lerp(bgTarget, 0.04);
    const gm = glow.material.uniforms;
    gm.uColor.value.lerp(mood, 0.05);
    gm.uAmt.value += ((0.26 - Math.abs(pos - near) * 0.4) * (1 - tailP) - gm.uAmt.value) * 0.08;
    tmp.copy(layout[near].pos);
    glow.position.lerp(tmp.setZ(tmp.z - 0.6), 0.08);
    glow.lookAt(camera.position);
    const du = dust.material.uniforms;
    du.uTime.value = t; du.uCamZ.value = camera.position.z;
    du.uFilm.value.lerp(layout[near].pos, 0.06);
    du.uColor.value.setRGB(Math.min(1, mood.r * 1.5 + 0.22), Math.min(1, mood.g * 1.5 + 0.2), Math.min(1, mood.b * 1.5 + 0.18));
    du.uAmt.value += ((0.5 + Math.min(Math.abs(v), 1) * 0.35) * (1 - tailP) * Math.min(1, open * 1.4) - du.uAmt.value) * 0.06;

    // iris: opens on the first frame, closes as the reel ends
    if (started) openTarget = 1 - tailP;
    const introT = started ? Math.min((now - t0) / 2400, 1) : 0;
    const want = Math.min(ease(introT), openTarget);
    open += (want - open) * (introT < 1 ? 0.25 : 0.12);
    iris.material.uniforms.uOpen.value = Math.max(open, 0.0);
    iris.material.uniforms.uTint.value.lerp(mood, 0.05);
    iris.material.uniforms.uTime.value = t;

    // hover
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(planes, false)[0];
    hoverIdx = hit ? hit.object.userData.i : -1;
    const onFilm = hoverIdx === near && Math.abs(pos - near) < 0.25;
    canvas.style.cursor = hoverIdx >= 0 ? (cursorOn || document.querySelector('.cursor') ? 'none' : 'pointer') : '';
    root.classList.toggle('ap-hovering', onFilm);
    watchCursor(onFilm && !cinema.isOpen());

    // the viewfinder locks onto the film in focus, with the film's own timecode
    if (ui.vf) {
      const m = planes[near];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < 4; k++) {
        corner.set(k & 1 ? 0.5 : -0.5, k & 2 ? 0.5 : -0.5, 0).applyMatrix4(m.matrixWorld).project(camera);
        const sx = (corner.x * 0.5 + 0.5) * innerWidth, sy = (-corner.y * 0.5 + 0.5) * innerHeight;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      const k = vf.o > 0.02 ? 0.35 : 1;
      vf.x += (x0 - vf.x) * k; vf.y += (y0 - vf.y) * k; vf.w += (x1 - x0 - vf.w) * k; vf.h += (y1 - y0 - vf.h) * k;
      const show = root.classList.contains('ap-moved') && settled && tailP < 0.15 && !cinema.isOpen() && pos > 0.5 ? 1 : 0;
      vf.o += (show - vf.o) * (show ? 0.08 : 0.25);
      const vs = ui.vf.style;
      vs.setProperty('--vf-x', vf.x.toFixed(1) + 'px'); vs.setProperty('--vf-y', vf.y.toFixed(1) + 'px');
      vs.setProperty('--vf-w', vf.w.toFixed(1) + 'px'); vs.setProperty('--vf-h', vf.h.toFixed(1) + 'px');
      vs.setProperty('--vf-o', vf.o.toFixed(3));
      const vid = m.userData.video;
      if (ui.tc && vf.o > 0.01) ui.tc.textContent = timecode(vid && m.userData.vtex ? vid.currentTime : 0);
    }

    // copy follows the reel
    showCaption(near);
    root.style.setProperty('--ap-hero', Math.max(0, 1 - pos * 2.2).toFixed(3));
    root.style.setProperty('--ap-end', tailP.toFixed(3));
    root.style.setProperty('--ap-open', open.toFixed(3));

    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (open < 0.999) { renderer.autoClear = false; renderer.render(irisScene, irisCam); }
  }
  function timecode(s) {
    const fr = Math.floor((s % 1) * 24), sec = Math.floor(s) % 60, min = Math.floor(s / 60) % 60, hr = Math.floor(s / 3600);
    return `${pad(hr)}:${pad(min)}:${pad(sec)}:${pad(fr)}`;
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); watchCursor(false); planes.forEach((m) => m.userData.video && m.userData.video.pause()); }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    iris.material.uniforms.uAspect.value = camera.aspect;
    dust.material.uniforms.uPx.value = dpr;
    dust.material.uniforms.uH.value = innerHeight;
    fitAll();
    measure();
  }
  addEventListener('resize', resize);
  resize();
  readScroll(); pos = prevPos = target;

  // only draw while the reel is on screen and the tab is visible
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && document.visibilityState === 'visible') start(); else stop(); }, { threshold: 0 });
  io.observe(track);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') stop(); else if (track.getBoundingClientRect().bottom > 0 && track.getBoundingClientRect().top < innerHeight) start(); });
  cinema.onChange((isOpen) => { if (isOpen) { watchCursor(false); planes.forEach((m) => m.userData.video && m.userData.video.pause()); } });
  loadPoster(planes[0]);
  wantVideo(planes[0], 2);
  if (N > 1) loadPoster(planes[1]);
}

// ---------------------------------------------------------------- what I make: a film under the pointer
// Hovering a service brings up a still from a film of that kind; it follows the pointer
// and leans with its speed. Pointer devices only; nothing here is needed to read the page.
function setupPeek() {
  const rows = [...document.querySelectorAll('[data-peek]')];
  if (!rows.length) return;
  const peek = document.createElement('div');
  peek.className = 'ap-peek';
  peek.setAttribute('aria-hidden', 'true');
  peek.innerHTML = '<img alt="">';
  document.body.appendChild(peek);
  const img = peek.querySelector('img');
  let x = 0, y = 0, tx = 0, ty = 0, vx = 0, on = false, raf = 0;
  function tick() {
    const nx = x + (tx - x) * 0.16, ny = y + (ty - y) * 0.16;
    vx += ((nx - x) - vx) * 0.2;
    x = nx; y = ny;
    peek.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${Math.max(-9, Math.min(9, vx * 0.35)).toFixed(2)}deg)`;
    raf = on || Math.abs(tx - x) > 0.5 ? requestAnimationFrame(tick) : 0;
  }
  rows.forEach((row) => {
    row.addEventListener('pointerenter', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      img.src = row.getAttribute('data-peek');
      peek.classList.toggle('is-v', row.getAttribute('data-peek-o') === 'v');
      if (!on) { x = tx = e.clientX; y = ty = e.clientY; }
      on = true; peek.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(tick);
    });
    row.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    row.addEventListener('pointerleave', () => { on = false; peek.classList.remove('is-on'); });
  });
}

// ---------------------------------------------------------------- cinema mode
// A click on the focused film opens it properly: full frame, sound, controls.
function setupCinema(root, cfg) {
  const box = root.querySelector('.ap-cinema');
  // a fixed overlay must not live inside anything that can become its containing block
  document.body.appendChild(box);
  const video = box.querySelector('video');
  const title = box.querySelector('.ap-cinema-title');
  const close = box.querySelector('.ap-cinema-close');
  let isOpen = false, lastFocus = null;
  const subs = [];
  const src = (p) => (/^(https?:)?\//.test(p) ? p : cfg.base + p);
  function open(i) {
    const f = cfg.films[i];
    if (!f) return;
    if (!isOpen) lastFocus = document.activeElement;
    video.src = src(f.video);
    video.poster = src(f.poster);
    video.classList.toggle('is-v', f.orient === 'v');
    title.textContent = `${f.title} — ${f.client}`;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    document.documentElement.classList.add('ap-locked');
    isOpen = true; subs.forEach((fn) => fn(true));
    video.muted = false;
    video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
    close.focus({ preventScroll: true });
  }
  function shut() {
    if (!isOpen) return;
    isOpen = false; subs.forEach((fn) => fn(false));
    box.classList.remove('is-open');
    video.pause();
    document.documentElement.classList.remove('ap-locked');
    setTimeout(() => { if (!isOpen) { box.hidden = true; video.removeAttribute('src'); try { video.load(); } catch (e) {} } }, 450);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  close.addEventListener('click', shut);
  box.addEventListener('click', (e) => { if (e.target === box) shut(); });
  addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') shut();
    if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === close ? video : close).focus(); }
  });
  return { open, close: shut, isOpen: () => isOpen, onChange: (fn) => subs.push(fn) };
}
