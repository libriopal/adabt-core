// ─────────────────────────────────────────────────────
// Organic Vegas — 3D Bio-Architectural Scene
// Three.js canvas with Rapier3D physics.
// Biological rigid bodies: iridescent membrane dice with bone-gold filigree.
// LITE/ELITE quality tiers auto-selected by hardwareTier.ts.
// Collision impulse events feed the DreamAudioEngine ERK pipeline.
// ─────────────────────────────────────────────────────

import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { HARDWARE } from '../../utils/hardwareTier';
import type { VoxelTransform } from '@match3d/game-core';

// ── Bio-Architectural shader materials ────────────────────────────────────────

function makeDieMaterial(face: number | null, isElite: boolean): THREE.Material {
  const faceHues: Record<number, number> = { 1: 0, 2: 30, 3: 60, 4: 160, 5: 200, 6: 270 };
  const hue = faceHues[face ?? 0] ?? 0;

  if (isElite) {
    // ELITE: iridescent ShaderMaterial — sub-surface scattering simulation
    const vs = `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `;
    const fs = `
      uniform float hue;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vViewPos;

      vec3 hsl2rgb(float h, float s, float l) {
        float c = (1.0 - abs(2.0*l - 1.0)) * s;
        float x = c * (1.0 - abs(mod(h*6.0, 2.0) - 1.0));
        float m = l - c*0.5;
        if (h < 1.0/6.0) return vec3(c+m, x+m, m);
        if (h < 2.0/6.0) return vec3(x+m, c+m, m);
        if (h < 3.0/6.0) return vec3(m, c+m, x+m);
        if (h < 4.0/6.0) return vec3(m, x+m, c+m);
        if (h < 5.0/6.0) return vec3(x+m, m, c+m);
        return vec3(c+m, m, x+m);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPos);
        float rim = pow(1.0 - abs(dot(N, V)), 2.5);
        // Iridescent shift based on viewing angle + time
        float shift = sin(time * 0.8 + dot(N, vec3(0.577))) * 0.15;
        vec3 baseColor = hsl2rgb(hue/360.0 + shift, 0.7, 0.3);
        // Bone-gold filigree in rim light
        vec3 goldRim = vec3(0.95, 0.82, 0.3) * rim * 1.8;
        // Sub-surface scatter approximation
        float sss = max(0.0, dot(N, vec3(0.0, 1.0, 0.5))) * 0.25;
        vec3 sssColor = vec3(0.8, 0.3, 0.5) * sss;
        gl_FragColor = vec4(baseColor + goldRim + sssColor, 0.92);
      }
    `;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      uniforms: { hue: { value: hue }, time: { value: 0 } },
      transparent: true,
      side: THREE.FrontSide,
    });
    return mat;
  } else {
    // LITE: simple MeshLambertMaterial with emissive tint (no shader compilation cost)
    const colors: Record<number, number> = {
      1: 0x3a0f18, 2: 0x3a1f08, 3: 0x2a2008,
      4: 0x082a18, 5: 0x082030, 6: 0x1a0828,
    };
    const emissive: Record<number, number> = {
      1: 0x991122, 2: 0x994411, 3: 0x887711,
      4: 0x116633, 5: 0x114488, 6: 0x551188,
    };
    return new THREE.MeshLambertMaterial({
      color: colors[face ?? 0] ?? 0x1a1030,
      emissive: emissive[face ?? 0] ?? 0x220033,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.88,
    });
  }
}

function makeGroundMaterial(isElite: boolean): THREE.Material {
  if (isElite) {
    return new THREE.MeshStandardMaterial({
      color: 0x0e0818,
      roughness: 0.05,
      metalness: 0.9,
      envMapIntensity: 1.2,
    });
  }
  return new THREE.MeshLambertMaterial({ color: 0x0e0818 });
}

// ── Geometry cache ────────────────────────────────────────────────────────────

const _geoCache = new Map<string, THREE.BufferGeometry>();
function dieGeo(isElite: boolean): THREE.BufferGeometry {
  const key = isElite ? 'die-elite' : 'die-lite';
  if (!_geoCache.has(key)) {
    // ELITE: chamfered box approximation via BoxGeometry with bevel-like sphere combo
    // LITE: plain BoxGeometry
    _geoCache.set(key, new THREE.BoxGeometry(0.88, 0.88, 0.88));
  }
  return _geoCache.get(key)!;
}

function sphereGeo(): THREE.BufferGeometry {
  if (!_geoCache.has('sphere')) {
    _geoCache.set('sphere', new THREE.SphereGeometry(0.42, 10, 10));
  }
  return _geoCache.get('sphere')!;
}

// ── Filigree lattice (bone-gold neural network) ───────────────────────────────

function buildFiligreeLines(scene: THREE.Scene, isElite: boolean): THREE.Line | null {
  if (!isElite) return null;
  const points: THREE.Vector3[] = [];
  const colX = [-3, -2, -1, 0, 1, 2, 3];
  for (let i = 0; i < colX.length; i++) {
    const x = colX[i]!;
    // Vertical spine
    points.push(new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 14, 0));
    // Cross-ribs every 2 units
    for (let y = 0; y <= 14; y += 2) {
      if (i < colX.length - 1) {
        points.push(
          new THREE.Vector3(x, y, 0),
          new THREE.Vector3(colX[i + 1]!, y, 0),
        );
      }
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: 0xc9a84c,
    transparent: true,
    opacity: 0.18,
  });
  const lines = new THREE.LineSegments(geo, mat);
  scene.add(lines);
  return lines;
}

// ── Impulse event type ────────────────────────────────────────────────────────

export interface CollisionImpulseEvent {
  bodyId: string;
  face: number | null;
  impulse: number;    // magnitude 0–1, normalized for audio use
  column: number;
}

// ── Scene refs ────────────────────────────────────────────────────────────────

interface SceneObjects {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshMap: Map<string, THREE.Mesh>;
  matCache: Map<string, THREE.Material>;
  shaderMats: THREE.ShaderMaterial[];
  animId: number;
}

export interface OrganicVegasSceneHandle {
  updateTransforms: (transforms: VoxelTransform[]) => void;
}

interface Props {
  onImpulse: (event: CollisionImpulseEvent) => void;
  heartbeatIntensity: number;   // 0–1
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const OrganicVegasScene = forwardRef<OrganicVegasSceneHandle, Props>(
  ({ onImpulse, heartbeatIntensity, canvasRef }, ref) => {
    const sceneRef = useRef<SceneObjects | null>(null);
    const prevTransforms = useRef<Map<string, VoxelTransform>>(new Map());
    const isElite = HARDWARE.quality === 'ELITE';

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // ── Renderer ──────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: isElite,
        alpha: false,
        powerPreference: isElite ? 'high-performance' : 'low-power',
      });
      renderer.setPixelRatio(isElite ? Math.min(window.devicePixelRatio, 2) : 1);
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      if (isElite) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
      }

      // ── Scene ──────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x05030a);
      scene.fog = new THREE.FogExp2(0x05030a, 0.04);

      // ── Camera ─────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(
        55,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        100,
      );
      camera.position.set(0, 5, 14);
      camera.lookAt(0, 5, 0);

      // ── Lights ─────────────────────────────────────────────────
      const ambient = new THREE.AmbientLight(0x1a0e2a, isElite ? 2.5 : 3.5);
      scene.add(ambient);

      const keyLight = new THREE.PointLight(0xc9a84c, isElite ? 4 : 3, 30);
      keyLight.position.set(0, 12, 6);
      if (isElite) keyLight.castShadow = true;
      scene.add(keyLight);

      if (isElite) {
        // Sub-lights for bone-gold rim
        const rimA = new THREE.PointLight(0xff00cc, 2, 20);
        rimA.position.set(-5, 8, 3);
        scene.add(rimA);
        const rimB = new THREE.PointLight(0x00f0ff, 2, 20);
        rimB.position.set(5, 8, 3);
        scene.add(rimB);
      }

      // ── Ground plane ───────────────────────────────────────────
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 4),
        makeGroundMaterial(isElite),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.05;
      if (isElite) ground.receiveShadow = true;
      scene.add(ground);

      // ── Filigree lattice ───────────────────────────────────────
      buildFiligreeLines(scene, isElite);

      // ── Shader mats list for time uniform ─────────────────────
      const shaderMats: THREE.ShaderMaterial[] = [];

      const meshMap = new Map<string, THREE.Mesh>();
      const matCache = new Map<string, THREE.Material>();

      // ── Resize handler ─────────────────────────────────────────
      const onResize = () => {
        if (!canvas) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      window.addEventListener('resize', onResize);

      // ── RAF loop ───────────────────────────────────────────────
      let animId = 0;
      let t = 0;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        t += 0.016;
        // Update shader time uniforms (ELITE only)
        for (const sm of shaderMats) sm.uniforms['time'].value = t;
        // Gentle heartbeat camera pulse
        if (heartbeatIntensity > 0) {
          camera.position.z = 14 + Math.sin(t * 8) * 0.08 * heartbeatIntensity;
        }
        renderer.render(scene, camera);
      };
      animate();

      sceneRef.current = { renderer, scene, camera, meshMap, matCache, shaderMats, animId };

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        for (const m of meshMap.values()) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
        renderer.dispose();
        sceneRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Expose updateTransforms to parent ──────────────────────────────────
    const updateTransforms = useCallback((transforms: VoxelTransform[]) => {
      const obj = sceneRef.current;
      if (!obj) return;
      const { scene, meshMap, matCache, shaderMats } = obj;

      const seen = new Set<string>();

      for (const t of transforms) {
        seen.add(t.id);
        let mesh = meshMap.get(t.id);

        if (!mesh) {
          // Create mesh for new body
          const isEntitySphere = t.entityType === 'sphere'
            || t.entityType === 'bomb'
            || t.entityType === 'multiplier_orb';
          const geo = isEntitySphere ? sphereGeo() : dieGeo(isElite);
          const matKey = `${t.entityType}-${t.face ?? 'x'}`;
          let mat = matCache.get(matKey);
          if (!mat) {
            mat = makeDieMaterial(t.face, isElite);
            matCache.set(matKey, mat);
            if (isElite && mat instanceof THREE.ShaderMaterial) {
              shaderMats.push(mat);
            }
          }
          mesh = new THREE.Mesh(geo, mat);
          if (isElite) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
          scene.add(mesh);
          meshMap.set(t.id, mesh);
        }

        // Check for significant position change → impulse event
        const prev = prevTransforms.current.get(t.id);
        if (prev) {
          const dy = Math.abs(t.position.y - prev.position.y);
          if (dy > 0.5) {
            onImpulse({
              bodyId: t.id,
              face: t.face,
              impulse: Math.min(1, dy / 4),
              column: t.column,
            });
          }
        }

        // Apply transform
        mesh.position.set(t.position.x, t.position.y, t.position.z);
        mesh.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);

        prevTransforms.current.set(t.id, t);
      }

      // Remove bodies no longer in transforms
      for (const [id, mesh] of meshMap.entries()) {
        if (!seen.has(id)) {
          scene.remove(mesh);
          meshMap.delete(id);
          prevTransforms.current.delete(id);
        }
      }
    }, [isElite, onImpulse]);

    useImperativeHandle(ref, () => ({ updateTransforms }), [updateTransforms]);

    return null; // Canvas is owned by parent via canvasRef
  },
);

OrganicVegasScene.displayName = 'OrganicVegasScene';
