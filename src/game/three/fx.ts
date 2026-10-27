import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * The trip's trails and the night's bloom (PLAN-3D.md 4.3). The scene goes through a composer only while one of them is on, otherwise the
 * renderer draws it straight: a render pass into a half-float target with 4 samples (the antialiasing the plain renderer has), the afterimage (trails
 * that fade with `damp`, longer the deeper the trip), the bloom (a soft glow on the lights, desktop only and only at night: GlowPass, four draws), and the output pass last (it turns the
 * linear picture into sRGB; without it the picture would jump darker whenever the composer switches on). The hue rotation and the roll are CSS on the canvas.
 */

const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }";
/**
 * The night's glow, in four draws instead of UnrealBloomPass's fifteen (the plan's 150-draw-call budget counts every fullscreen pass): the bright part of the
 * picture at a quarter of its size, blurred across and then down with a 17-tap kernel one texel apart (a wider spacing leaves bands on thin bright lines), and added back over the picture with `strength`.
 */
class GlowPass extends Pass {
  strength = 0.6;
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private quad = new FullScreenQuad();
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private comp: THREE.ShaderMaterial;
  constructor(w: number, h: number) {
    super();
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.a = new THREE.WebGLRenderTarget(1, 1, opts); this.b = new THREE.WebGLRenderTarget(1, 1, opts);
    this.setSize(w, h);
    this.bright = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, threshold: { value: 0.75 } }, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv; void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(threshold, threshold + 0.35, l), 1.0); }" });
    this.blur = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, step: { value: new THREE.Vector2() } }, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D tDiffuse; uniform vec2 step; varying vec2 vUv; void main() { vec3 s = texture2D(tDiffuse, vUv).rgb; float tot = 1.0; for (int i = 1; i <= 8; i++) { float w = exp(-float(i * i) / 32.0); vec2 o = step * float(i); s += (texture2D(tDiffuse, vUv + o).rgb + texture2D(tDiffuse, vUv - o).rgb) * w; tot += 2.0 * w; } gl_FragColor = vec4(s / tot, 1.0); }" });
    this.comp = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tGlow: { value: null }, strength: { value: 0.6 } }, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: "uniform sampler2D tDiffuse; uniform sampler2D tGlow; uniform float strength; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb + texture2D(tGlow, vUv).rgb * strength, 1.0); }" });
  }
  setSize(w: number, h: number): void { const qw = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4)); this.a.setSize(qw, qh); this.b.setSize(qw, qh); }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const pass = (mat: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null) => { this.quad.material = mat; renderer.setRenderTarget(to); this.quad.render(renderer); };
    this.bright.uniforms.tDiffuse.value = readBuffer.texture; pass(this.bright, this.a);
    this.blur.uniforms.tDiffuse.value = this.a.texture; this.blur.uniforms.step.value.set(1 / this.a.width, 0); pass(this.blur, this.b);
    this.blur.uniforms.tDiffuse.value = this.b.texture; this.blur.uniforms.step.value.set(0, 1 / this.a.height); pass(this.blur, this.a);
    this.comp.uniforms.tDiffuse.value = readBuffer.texture; this.comp.uniforms.tGlow.value = this.a.texture; this.comp.uniforms.strength.value = this.strength;
    pass(this.comp, this.renderToScreen ? null : writeBuffer);
  }
  dispose(): void { this.a.dispose(); this.b.dispose(); this.quad.dispose(); this.bright.dispose(); this.blur.dispose(); this.comp.dispose(); }
}

/** The composer draws at most this many pixels per CSS pixel: a half-float target with 4 samples at 2x on a big retina window is over 100 MB. */
const MAX_DPR = 1.5;
export class Fx {
  private composer: EffectComposer;
  private after: AfterimagePass;
  private bloom: GlowPass;
  private trailsOn = false;
  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, dpr: number) {
    dpr = Math.min(dpr, MAX_DPR);
    const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)), { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    this.after = new AfterimagePass(0.9); this.after.enabled = false;
    this.bloom = new GlowPass(Math.round(w * dpr), Math.round(h * dpr)); this.bloom.enabled = false;
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.after); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, dpr: number): void { dpr = Math.min(dpr, MAX_DPR); this.composer.setPixelRatio(dpr); this.composer.setSize(w, h); this.bloom.setSize(Math.round(w * dpr), Math.round(h * dpr)); }
  /** Whether the picture needs the composer at all this frame. */
  wanted(trip: number, night: number, touch: boolean): boolean { return trip > 0.02 || (night > 0.3 && !touch); }
  /** Draw the frame through the composer; the caller has checked `wanted`. */
  render(trip: number, night: number, touch: boolean, dt: number): void {
    const trails = trip > 0.02;
    if (trails && !this.trailsOn) this.clearTrails();   // the old trails are long gone: start clean
    this.trailsOn = trails;
    this.after.enabled = trails; this.after.damp = 0.84 + 0.12 * trip;
    const glow = night > 0.3 && !touch;
    this.bloom.enabled = glow; this.bloom.strength = 0.9 * night;
    this.composer.render(dt);
  }
  private clearTrails(): void {
    const a = this.after as unknown as { _textureComp?: THREE.WebGLRenderTarget; _textureOld?: THREE.WebGLRenderTarget };
    for (const t of [a._textureComp, a._textureOld]) if (t) { this.renderer.setRenderTarget(t); this.renderer.clear(); }
    this.renderer.setRenderTarget(null);
  }
  dispose(): void { this.composer.dispose(); this.bloom.dispose(); this.after.dispose(); }
}
