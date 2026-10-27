import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * The trip's trails and the night's bloom (PLAN-3D.md 4.3). The scene goes through a composer only while one of them is on, otherwise the
 * renderer draws it straight: a render pass into a half-float target with 4 samples (the antialiasing the plain renderer has), the afterimage (trails
 * that fade with `damp`, longer the deeper the trip), the bloom (a soft glow on the lights, desktop only and only at night), and the output pass last (it turns the
 * linear picture into sRGB; without it the picture would jump darker whenever the composer switches on). The hue rotation and the roll are CSS on the canvas.
 */
export class Fx {
  private composer: EffectComposer;
  private after: AfterimagePass;
  private bloom: UnrealBloomPass;
  private trailsOn = false;
  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, dpr: number) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr)), { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    this.after = new AfterimagePass(0.9); this.after.enabled = false;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.4, 0.85); this.bloom.enabled = false;
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.after); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, dpr: number): void { this.composer.setPixelRatio(dpr); this.composer.setSize(w, h); this.bloom.resolution.set(w, h); }
  /** Whether the picture needs the composer at all this frame. */
  wanted(trip: number, night: number, touch: boolean): boolean { return trip > 0.02 || (night > 0.3 && !touch); }
  /** Draw the frame through the composer; the caller has checked `wanted`. */
  render(trip: number, night: number, touch: boolean, dt: number): void {
    const trails = trip > 0.02;
    if (trails && !this.trailsOn) this.clearTrails();   // the old trails are long gone: start clean
    this.trailsOn = trails;
    this.after.enabled = trails; this.after.damp = 0.84 + 0.12 * trip;
    const glow = night > 0.3 && !touch;
    this.bloom.enabled = glow; this.bloom.strength = 0.55 * night;
    this.composer.render(dt);
  }
  private clearTrails(): void {
    const a = this.after as unknown as { _textureComp?: THREE.WebGLRenderTarget; _textureOld?: THREE.WebGLRenderTarget };
    for (const t of [a._textureComp, a._textureOld]) if (t) { this.renderer.setRenderTarget(t); this.renderer.clear(); }
    this.renderer.setRenderTarget(null);
  }
  dispose(): void { this.composer.dispose(); this.bloom.dispose(); this.after.dispose(); }
}
