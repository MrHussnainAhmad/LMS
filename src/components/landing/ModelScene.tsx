"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type ScenePreset = "laptop" | "building" | "phone" | "cap";

type ModelSceneProps = {
  model: string;
  preset: ScenePreset;
  label: string;
  eager?: boolean;
  preloadNext?: string;
};

const preloadedModels = new Set<string>();

function preloadModel(model: string) {
  if (preloadedModels.has(model)) return;
  preloadedModels.add(model);

  void fetch(model, {
    cache: "force-cache",
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) preloadedModels.delete(model);
    })
    .catch(() => {
      preloadedModels.delete(model);
    });
}

const presets: Record<
  ScenePreset,
  {
    size: number;
    rotation: [number, number, number];
    cameraZ: number;
    modelY: number;
    ground: number;
    light: number;
  }
> = {
  laptop: {
    size: 3.8,
    rotation: [0.02, -0.35, -0.02],
    cameraZ: 6.2,
    modelY: 0.16,
    ground: 0xd9d6ce,
    light: 0xc7de5d,
  },
  building: {
    size: 4.2,
    rotation: [-0.02, 0.62, 0],
    cameraZ: 6.7,
    modelY: 0.05,
    ground: 0xcfc8ba,
    light: 0xf1a66f,
  },
  phone: {
    size: 2.9,
    rotation: [0.04, -0.38, -0.04],
    cameraZ: 5.7,
    modelY: 0.28,
    ground: 0x9d3925,
    light: 0xffc7a0,
  },
  cap: {
    size: 2.65,
    rotation: [-0.08, 0.4, -0.08],
    cameraZ: 5.6,
    modelY: 0.42,
    ground: 0x1d2927,
    light: 0xbfd964,
  },
};

function prepareModel(object: THREE.Object3D, targetSize: number) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largestAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / largestAxis;

  object.scale.setScalar(scale);
  object.position.copy(center).multiplyScalar(-scale);

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 0.7;
        material.roughness = Math.max(material.roughness, 0.32);
      }
    });
  });
}

export function ModelScene({
  model,
  preset,
  label,
  eager = false,
  preloadNext,
}: ModelSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldMount, setShouldMount] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (shouldMount) return;
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldMount(true);
        observer.disconnect();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [shouldMount]);

  useEffect(() => {
    if (!shouldMount) return;
    const host = hostRef.current;
    if (!host) return;

    const config = presets[preset];
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
    camera.position.set(0, 0.25, config.cameraZ);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: window.devicePixelRatio <= 1.5,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setClearColor(0x000000, 0);
    const compactViewport = window.matchMedia("(max-width: 767px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, compactViewport ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, config.ground, 2.6);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 4.5);
    key.position.set(-3, 5, 5);
    key.castShadow = true;
    const shadowMapSize = compactViewport ? 512 : 1024;
    key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    scene.add(key);

    const edge = new THREE.PointLight(config.light, 13, 10, 2);
    edge.position.set(3.5, 1.5, 3);
    scene.add(edge);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.set(...config.rotation);
    modelRoot.position.y = config.modelY;
    scene.add(modelRoot);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 48),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: preset === "phone" ? 0.22 : 0.16 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.25;
    shadow.receiveShadow = true;
    scene.add(shadow);

    let disposed = false;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      model,
      (gltf) => {
        if (disposed) return;
        prepareModel(gltf.scene, config.size);
        modelRoot.add(gltf.scene);
        setLoaded(true);
        if (preloadNext) preloadModel(preloadNext);
      },
      undefined,
      () => {
        // The typographic fallback remains visible if the GLB cannot be loaded.
      },
    );

    const pointer = new THREE.Vector2();
    const target = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      target.set(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
      );
    };
    const onPointerLeave = () => target.set(0, 0);
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = config.cameraZ + (width < 520 ? 1.15 : 0);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    const frameInterval = compactViewport || reducedMotion ? 1000 / 30 : 1000 / 60;
    let visible = false;
    let frame = 0;
    let previousFrameTime = 0;

    const render = (time: number) => {
      frame = 0;
      if (!visible || document.hidden || disposed) return;

      if (time - previousFrameTime >= frameInterval) {
        previousFrameTime = time;
        const elapsed = clock.getElapsedTime();
        pointer.lerp(target, 0.045);
        modelRoot.rotation.y +=
          (config.rotation[1] + pointer.x * 0.12 - modelRoot.rotation.y) * 0.035;
        modelRoot.rotation.x +=
          (config.rotation[0] - pointer.y * 0.05 - modelRoot.rotation.x) * 0.035;
        if (!reducedMotion) {
          modelRoot.position.y = config.modelY + Math.sin(elapsed * 0.72) * 0.055;
        }
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }

      frame = window.requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (!frame && visible && !document.hidden) {
        clock.getDelta();
        frame = window.requestAnimationFrame(render);
      }
    };

    const stopRendering = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) startRendering();
      else stopRendering();
    });
    visibilityObserver.observe(host);

    const onVisibilityChange = () => {
      if (document.hidden) stopRendering();
      else startRendering();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      stopRendering();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) value.dispose();
          });
          material.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [model, preloadNext, preset, shouldMount]);

  return (
    <div ref={hostRef} className="absolute inset-0">
      <div
        className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${
          loaded ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-hidden="true"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-35">
          {label}
        </span>
      </div>
    </div>
  );
}
