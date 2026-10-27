import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { AfterimageShader } from "three/examples/jsm/shaders/AfterimageShader.js";

/**
 * The trip's trails and the night's bloom (PLAN-3D.md 4.3). The scene goes through these passes only while one of them is on, otherwise the
 * renderer draws it straight: the scene into one half-float target with 4 samples (the antialiasing the plain renderer has) which resolves to a
 * texture, the trails (what is brighter of this frame and the last one's fade, `damp` a second, longer the deeper the trip), the bloom (a soft glow
 * on the lights, desktop only and only at night: four draws), and the output pass last (it turns the linear picture into sRGB; without it the
 * picture would jump darker whenever the passes switch on). Only the scene's target is multisampled and has a depth buffer; the passes
 * after it work in plain half-float textures, and a pass that is off costs nothing (the trails' two, the bloom's glow pair and the one
 * picture-sized buffer between the bloom and the output are made the first time they are used). The hue rotation and the roll are CSS on the canvas.
 *
 * Memory (the GPU's, per output pixel): the scene 56 bytes (4 samples of colour and depth, and the resolved colour), the buffer between the bloom
 * and the output 8, the trails' pair 16: 64 at night, 80 at night on a trip. The pass buffers are given back after IDLE seconds with no night and no trip,
 * and the shaders are kept, so the next night starts without a compile.
 */

const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }";
/** The most pixels per CSS pixel the passes draw at (the renderer's own cap is 2), and the most pixels in all: a 2560 by 1440 window draws at 1.3, not 2. */
const MAX_DPR = 2, MAX_PIXELS = 6e6;
/** Seconds with neither the night's glow nor the trip on before the buffers are freed. */
const IDLE = 2;
/** The ratio the passes' buffers are drawn at for a w by h (CSS pixels) window on a screen of `dpr`. */
export const fxRatio = (w: number, h: number, dpr: number) => Math.min(dpr, MAX_DPR, Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));
const half = (extra: THREE.RenderTargetOptions = {}) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, ...extra });
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The night's glow, in four draws instead of UnrealBloomPass's fifteen (the plan's 150-draw-call budget counts every fullscreen pass): the bright part of the
 * picture at a quarter of its size, blurred across and then down with a 17-tap kernel one texel apart (a wider spacing leaves bands on thin bright lines), and added back over the picture with `strength`.
 */
class GlowPass {
  private a = half({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  private b = half({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  private quad = new FullScreenQuad();
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private comp: THREE.ShaderMaterial;
  constructor() {
    this.bright = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, threshold: { value: 0.75 } }, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv; void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(threshold, threshold + 0.35, l), 1.0); }" });
    this.blur = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, step: { value: new THREE.Vector2() } }, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D tDiffuse; uniform vec2 step; varying vec2 vUv; void main() { vec3 s = texture2D(tDiffuse, vUv).rgb; float tot = 1.0; for (int i = 1; i <= 8; i++) { float w = exp(-float(i * i) / 32.0); vec2 o = step * float(i); s += (texture2D(tDiffuse, vUv + o).rgb + texture2D(tDiffuse, vUv - o).rgb) * w; tot += 2.0 * w; } gl_FragColor = vec4(s / tot, 1.0); }" });
    this.comp = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tGlow: { value: null }, strength: { value: 0.6 } }, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D tDiffuse; uniform sampler2D tGlow; uniform float strength; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb + texture2D(tGlow, vUv).rgb * strength, 1.0); }" });
  }
  setSize(w: number, h: number): void { const qw = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4)); this.a.setSize(qw, qh); this.b.setSize(qw, qh); }
  /** `src` and the glow of its bright parts, added at `strength`, into `to`. */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, to: THREE.WebGLRenderTarget, strength: number): void {
    const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) => { this.quad.material = mat; renderer.setRenderTarget(target); this.quad.render(renderer); };
    this.bright.uniforms.tDiffuse.value = src; pass(this.bright, this.a);
    this.blur.uniforms.tDiffuse.value = this.a.texture; this.blur.uniforms.step.value.set(1 / this.a.width, 0); pass(this.blur, this.b);
    this.blur.uniforms.tDiffuse.value = this.b.texture; this.blur.uniforms.step.value.set(0, 1 / this.a.height); pass(this.blur, this.a);
    this.comp.uniforms.tDiffuse.value = src; this.comp.uniforms.tGlow.value = this.a.texture; this.comp.uniforms.strength.value = strength;
    pass(this.comp, to);
  }
  /** Give the GPU its memory back (the next render makes the buffers again). */
  release(): void { this.a.dispose(); this.b.dispose(); }
  dispose(): void { this.release(); this.quad.dispose(); this.bright.dispose(); this.blur.dispose(); this.comp.dispose(); }
}

/**
 * The trip's trails: each frame is the brighter of the new picture and the last frame's fade (three's afterimage shader), drawn once into a buffer
 * that the next pass reads as it is. `damp` is what is left of the last frame after a second, so the trails last as long at 144 fps as at 30.
 */
class TrailPass {
  private old = half({ magFilter: THREE.NearestFilter });
  private cur = half({ magFilter: THREE.NearestFilter });
  private quad: FullScreenQuad;
  private mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(AfterimageShader.uniforms), vertexShader: VERT, fragmentShader: AfterimageShader.fragmentShader, depthTest: false, depthWrite: false });
  private black = new THREE.Color();
  constructor() { this.quad = new FullScreenQuad(this.mat); }
  setSize(w: number, h: number): void { this.old.setSize(w, h); this.cur.setSize(w, h); }
  /** Both buffers to black (not the clear colour the scene's background left set: that is the sky): no trails yet. */
  clear(renderer: THREE.WebGLRenderer): void {
    const alpha = renderer.getClearAlpha(); renderer.getClearColor(this.black);
    renderer.setClearColor(0x000000, 0);
    for (const t of [this.old, this.cur]) { renderer.setRenderTarget(t); renderer.clear(); }
    renderer.setClearColor(this.black, alpha);
  }
  /** The frame `src` with the last frame's trails behind it, as a texture; `damp` is the share of the last frame left a second later. */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, damp: number, dt: number): THREE.Texture {
    this.mat.uniforms.damp.value = Math.pow(damp, dt * 60);
    this.mat.uniforms.tOld.value = this.old.texture; this.mat.uniforms.tNew.value = src;
    renderer.setRenderTarget(this.cur); this.quad.render(renderer);
    [this.old, this.cur] = [this.cur, this.old];
    return this.old.texture;
  }
  release(): void { this.old.dispose(); this.cur.dispose(); }
  dispose(): void { this.release(); this.quad.dispose(); this.mat.dispose(); }
}

export class Fx {
  private scene3: THREE.WebGLRenderTarget;
  private ping = half({ minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  private trail = new TrailPass();
  private bloom = new GlowPass();
  private output = new OutputPass();
  private trailsOn = false;
  private live = false;
  private idle_ = 0;
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera, w: number, h: number, dpr: number) {
    this.scene3 = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.setSize(w, h, dpr);
  }
  setSize(w: number, h: number, dpr: number): void {
    const r = fxRatio(w, h, dpr), pw = Math.max(1, Math.round(w * r)), ph = Math.max(1, Math.round(h * r));
    this.scene3.setSize(pw, ph); this.ping.setSize(pw, ph); this.trail.setSize(pw, ph); this.bloom.setSize(pw, ph);
  }
  /** Whether the picture needs these passes at all this frame. */
  static wanted(trip: number, night: number, touch: boolean): boolean { return trip > 0.02 || (night > 0.3 && !touch); }
  /** Draw the frame through the passes; the caller has checked `wanted`. */
  render(trip: number, night: number, touch: boolean, dt: number): void {
    const r = this.renderer, trails = trip > 0.02, glow = night > 0.3 && !touch;
    this.live = true; this.idle_ = 0;
    if (trails && !this.trailsOn) this.trail.clear(r);   // the old trails are long gone: start clean
    this.trailsOn = trails;
    r.setRenderTarget(this.scene3); r.render(this.scene, this.camera);   // the 4 samples resolve into scene3.texture
    let src = this.scene3.texture;
    if (trails) src = this.trail.render(r, src, 0.84 + 0.12 * trip, dt);
    // the glow comes in from nothing as the composer does (at night 0.3) and is at the old strength by night 0.5
    if (glow) { this.bloom.render(r, src, this.ping, 0.9 * night * smooth(0.3, 0.5, night)); src = this.ping.texture; }
    this.output.renderToScreen = true;
    this.output.render(r, null as unknown as THREE.WebGLRenderTarget, { texture: src } as THREE.WebGLRenderTarget, dt, false);
  }
  /** The frame went straight to the screen: forget the trails (they will be cleared when the next trip starts) and, after IDLE seconds of this, give the buffers back. */
  idle(dt: number): void {
    this.trailsOn = false;
    if (!this.live) return;
    this.idle_ += dt;
    if (this.idle_ > IDLE) this.release();
  }
  /** The GPU memory of every buffer back; the shaders stay, so the next render allocates and does not compile. */
  release(): void {
    this.live = false; this.trailsOn = false;
    this.scene3.dispose(); this.ping.dispose(); this.trail.release(); this.bloom.release();
  }
  /** One frame through every pass (the trip and the night's glow on), so the shaders, the scene's among them for a target rather than the screen, are compiled before they are needed; the buffers are then given back. */
  warm(): void {
    this.render(1, 1, false, 1 / 60); this.renderer.setRenderTarget(null); this.release();
  }
  dispose(): void { this.release(); this.trail.dispose(); this.bloom.dispose(); this.output.dispose(); }
}
