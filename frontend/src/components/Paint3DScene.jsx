"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Palette definitions for the 3D buckets matching reference imagery
const BUCKET_PALETTES = [
  {
    id: "cyan-blue",
    name: "Electric Cyan",
    hex: "#00D2FF",
    position: [-4.2, 0.4, -1.0],
    scale: 0.95,
    rotation: [0.15, 0.35, -0.1],
    splashDirection: [-0.6, 1.2, 0.2],
    hasBrush: true,
    brushOffset: [0.3, 1.4, 0.2],
  },
  {
    id: "hot-pink",
    name: "Neon Magenta",
    hex: "#FF1493",
    position: [-2.2, 1.6, -2.5],
    scale: 0.82,
    rotation: [-0.1, -0.2, 0.15],
    splashDirection: [0.3, 1.4, -0.1],
    hasBrush: true,
    brushOffset: [-0.2, 1.3, 0.1],
  },
  {
    id: "active-primary",
    name: "Active Selection",
    hex: "#385E72", // Dynamically synced with user selectedColor
    position: [0.0, -0.2, 0.2],
    scale: 1.15,
    rotation: [0.05, 0.0, 0.0],
    splashDirection: [0.0, 1.6, 0.1],
    hasBrush: true,
    brushOffset: [0.4, 1.6, 0.3],
    isInteractiveTarget: true,
  },
  {
    id: "lemon-yellow",
    name: "Lemon Zing",
    hex: "#FFE600",
    position: [2.3, 1.4, -2.2],
    scale: 0.88,
    rotation: [0.1, 0.4, -0.15],
    splashDirection: [-0.4, 1.3, -0.2],
    hasBrush: true,
    brushOffset: [0.2, 1.4, 0.1],
  },
  {
    id: "vivid-orange",
    name: "Coral Tangerine",
    hex: "#FF5E13",
    position: [4.4, 0.2, -1.2],
    scale: 0.98,
    rotation: [-0.12, -0.3, 0.08],
    splashDirection: [0.7, 1.3, 0.1],
    hasBrush: true,
    brushOffset: [-0.3, 1.5, 0.2],
  },
  {
    id: "lime-green",
    name: "Acid Lime",
    hex: "#76FF03",
    position: [-3.3, -1.6, -1.8],
    scale: 0.78,
    rotation: [0.2, -0.4, 0.1],
    splashDirection: [-0.5, 1.1, 0.3],
    hasBrush: false,
  },
  {
    id: "royal-purple",
    name: "Electric Violet",
    hex: "#9D00FF",
    position: [3.4, -1.5, -1.6],
    scale: 0.8,
    rotation: [-0.15, 0.3, -0.12],
    splashDirection: [0.5, 1.0, -0.2],
    hasBrush: false,
  },
];

export default function Paint3DScene({ selectedColor, onColorSelect }) {
  const containerRef = useRef(null);
  const [hoveredBucket, setHoveredBucket] = useState(null);
  const activeBucketColorRef = useRef(selectedColor);

  useEffect(() => {
    activeBucketColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.035);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    camera.position.set(0, 0.6, 9.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup (Bright High-End Design Studio)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    mainKeyLight.position.set(6, 10, 8);
    mainKeyLight.castShadow = true;
    mainKeyLight.shadow.mapSize.width = 1024;
    mainKeyLight.shadow.mapSize.height = 1024;
    mainKeyLight.shadow.camera.near = 0.5;
    mainKeyLight.shadow.camera.far = 25;
    scene.add(mainKeyLight);

    // Studio Cyan Fill Light
    const cyanFillLight = new THREE.DirectionalLight(0x00f0ff, 1.1);
    cyanFillLight.position.set(-8, -2, 4);
    scene.add(cyanFillLight);

    // Warm Magenta / Amber Rim Light
    const warmRimLight = new THREE.DirectionalLight(0xff77aa, 1.2);
    warmRimLight.position.set(5, -4, -4);
    scene.add(warmRimLight);

    // 3. Shared Materials
    const bucketExteriorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.08,
    });

    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
    });

    const brushWoodMat = new THREE.MeshStandardMaterial({
      color: 0xd4a373,
      roughness: 0.6,
      metalness: 0.05,
    });

    const brushFerruleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.18,
    });

    // 4. Procedural Geometry Builders
    function createBucketMesh(bucketColorHex, isTarget = false) {
      const bucketGroup = new THREE.Group();

      // Bucket Outer Body (slightly tapered cylinder)
      const outerGeo = new THREE.CylinderGeometry(0.78, 0.64, 1.4, 32, 1, true);
      const outerMesh = new THREE.Mesh(outerGeo, bucketExteriorMat);
      outerMesh.castShadow = true;
      outerMesh.receiveShadow = true;
      bucketGroup.add(outerMesh);

      // Bucket Bottom
      const bottomGeo = new THREE.CircleGeometry(0.64, 32);
      const bottomMesh = new THREE.Mesh(bottomGeo, bucketExteriorMat);
      bottomMesh.rotation.x = Math.PI / 2;
      bottomMesh.position.y = -0.7;
      bucketGroup.add(bottomMesh);

      // Bucket Top Rim Lip (torus ring for realistic edge)
      const rimGeo = new THREE.TorusGeometry(0.78, 0.045, 16, 32);
      const rimMesh = new THREE.Mesh(rimGeo, bucketExteriorMat);
      rimMesh.rotation.x = Math.PI / 2;
      rimMesh.position.y = 0.7;
      bucketGroup.add(rimMesh);

      // Liquid Paint Surface (glossy acrylic with clearcoat)
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(bucketColorHex),
        roughness: 0.08,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        reflectivity: 0.9,
      });

      const liquidGeo = new THREE.CircleGeometry(0.74, 32);
      const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
      liquidMesh.rotation.x = -Math.PI / 2;
      liquidMesh.position.y = 0.65;
      bucketGroup.add(liquidMesh);

      // Overflowing paint drip lip running over edge
      const dripGeo = new THREE.SphereGeometry(0.16, 16, 16);
      dripGeo.scale(1.2, 2.2, 0.8);
      const dripMesh = new THREE.Mesh(dripGeo, liquidMat);
      dripMesh.position.set(0.68, 0.45, 0.2);
      dripMesh.rotation.z = -0.3;
      bucketGroup.add(dripMesh);

      const dripGeo2 = new THREE.SphereGeometry(0.12, 16, 16);
      dripGeo2.scale(1.0, 1.8, 0.7);
      const dripMesh2 = new THREE.Mesh(dripGeo2, liquidMat);
      dripMesh2.position.set(-0.64, 0.52, -0.2);
      dripMesh2.rotation.z = 0.25;
      bucketGroup.add(dripMesh2);

      // Wire Handle
      const handleCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-0.82, 0.68, 0),
        new THREE.Vector3(-0.95, 1.45, 0.2),
        new THREE.Vector3(0.95, 1.45, 0.2),
        new THREE.Vector3(0.82, 0.68, 0)
      );
      const handleGeo = new THREE.TubeGeometry(handleCurve, 32, 0.025, 8, false);
      const handleMesh = new THREE.Mesh(handleGeo, handleMat);
      bucketGroup.add(handleMesh);

      return {
        group: bucketGroup,
        liquidMat,
        isTarget,
      };
    }

    function createSplashMesh(splashColorHex, direction) {
      const splashGroup = new THREE.Group();

      const splashMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(splashColorHex),
        roughness: 0.06,
        metalness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        transmission: 0.05,
        ior: 1.45,
      });

      // 1. Main Curved Fluid Ribbon
      const points = [];
      const dirX = direction[0];
      const dirY = direction[1];
      const dirZ = direction[2];

      points.push(new THREE.Vector3(0, 0.65, 0));
      points.push(new THREE.Vector3(dirX * 0.4, 0.65 + dirY * 0.4, dirZ * 0.3));
      points.push(new THREE.Vector3(dirX * 0.9, 0.65 + dirY * 0.85, dirZ * 0.6));
      points.push(new THREE.Vector3(dirX * 1.5, 0.65 + dirY * 1.2, dirZ * 0.9));
      points.push(new THREE.Vector3(dirX * 2.1, 0.65 + dirY * 1.0, dirZ * 1.2));

      const curve = new THREE.CatmullRomCurve3(points);
      const ribbonGeo = new THREE.TubeGeometry(curve, 40, 0.14, 12, false);
      const ribbonMesh = new THREE.Mesh(ribbonGeo, splashMat);
      ribbonMesh.castShadow = true;
      splashGroup.add(ribbonMesh);

      // 2. Secondary Arching Tendril
      const points2 = [];
      points2.push(new THREE.Vector3(0, 0.65, 0));
      points2.push(new THREE.Vector3(-dirX * 0.5, 0.65 + dirY * 0.5, -dirZ * 0.2));
      points2.push(new THREE.Vector3(-dirX * 1.1, 0.65 + dirY * 1.1, dirZ * 0.4));
      points2.push(new THREE.Vector3(-dirX * 1.6, 0.65 + dirY * 0.8, dirZ * 0.6));

      const curve2 = new THREE.CatmullRomCurve3(points2);
      const ribbonGeo2 = new THREE.TubeGeometry(curve2, 32, 0.09, 10, false);
      const ribbonMesh2 = new THREE.Mesh(ribbonGeo2, splashMat);
      splashGroup.add(ribbonMesh2);

      // 3. Airborne Splash Droplets
      for (let i = 0; i < 6; i++) {
        const radius = 0.04 + Math.random() * 0.08;
        const dropGeo = new THREE.SphereGeometry(radius, 14, 14);
        dropGeo.scale(1.0, 1.3, 1.0);
        const dropMesh = new THREE.Mesh(dropGeo, splashMat);

        const progress = 0.3 + Math.random() * 0.8;
        dropMesh.position.set(
          dirX * (1.2 + Math.random() * 1.2),
          0.65 + dirY * (0.8 + Math.random() * 1.1),
          dirZ * (0.4 + Math.random() * 1.0)
        );
        dropMesh.rotation.z = Math.random() * Math.PI;
        splashGroup.add(dropMesh);
      }

      return { group: splashGroup, splashMat };
    }

    function createPaintbrushMesh(bristleColorHex) {
      const brushGroup = new THREE.Group();

      // Wooden Handle
      const handleGeo = new THREE.CylinderGeometry(0.04, 0.08, 1.4, 16);
      const handleMesh = new THREE.Mesh(handleGeo, brushWoodMat);
      handleMesh.position.y = 0.8;
      brushGroup.add(handleMesh);

      // Metal Ferrule
      const ferruleGeo = new THREE.CylinderGeometry(0.085, 0.09, 0.3, 16);
      const ferruleMesh = new THREE.Mesh(ferruleGeo, brushFerruleMat);
      ferruleMesh.position.y = 0.05;
      brushGroup.add(ferruleMesh);

      // Bristles with Coated Paint Tip
      const bristleMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(bristleColorHex),
        roughness: 0.15,
        clearcoat: 0.8,
      });

      const bristleGeo = new THREE.ConeGeometry(0.11, 0.45, 16);
      bristleGeo.scale(1.2, 1.0, 0.4); // Flat chisel brush shape
      const bristleMesh = new THREE.Mesh(bristleGeo, bristleMat);
      bristleMesh.rotation.x = Math.PI;
      bristleMesh.position.y = -0.28;
      brushGroup.add(bristleMesh);

      return { group: brushGroup, bristleMat };
    }

    // 5. Build Scene Instances from Palette Definitions
    const bucketObjects = [];
    const interactiveMeshes = [];

    BUCKET_PALETTES.forEach((cfg, idx) => {
      const isTarget = !!cfg.isInteractiveTarget;
      const initialColor = isTarget ? activeBucketColorRef.current : cfg.hex;

      const bucket = createBucketMesh(initialColor, isTarget);
      bucket.group.position.set(...cfg.position);
      bucket.group.scale.setScalar(cfg.scale);
      bucket.group.rotation.set(...cfg.rotation);
      bucket.group.userData = { id: cfg.id, hex: cfg.hex, basePos: [...cfg.position], phase: idx * 1.1 };
      scene.add(bucket.group);

      // Collect for raycasting
      bucket.group.traverse((child) => {
        if (child.isMesh) {
          child.userData = { parentConfig: cfg };
          interactiveMeshes.push(child);
        }
      });

      // Add fluid splash
      const splash = createSplashMesh(initialColor, cfg.splashDirection);
      splash.group.position.set(...cfg.position);
      splash.group.scale.setScalar(cfg.scale);
      scene.add(splash.group);

      // Add paintbrush if defined
      let brushObj = null;
      if (cfg.hasBrush && cfg.brushOffset) {
        brushObj = createPaintbrushMesh(initialColor);
        brushObj.group.position.set(
          cfg.position[0] + cfg.brushOffset[0],
          cfg.position[1] + cfg.brushOffset[1],
          cfg.position[2] + cfg.brushOffset[2]
        );
        brushObj.group.rotation.set(0.3, 0.2, -0.4);
        brushObj.group.scale.setScalar(cfg.scale * 1.1);
        scene.add(brushObj.group);
      }

      bucketObjects.push({
        config: cfg,
        bucket,
        splash,
        brush: brushObj,
        basePos: [...cfg.position],
        phase: idx * 0.95,
      });
    });

    // 6. Ambient Floating Fine Droplets
    const ambientDroplets = [];
    const dropletGeo = new THREE.SphereGeometry(0.06, 12, 12);
    for (let i = 0; i < 24; i++) {
      const randomColor = BUCKET_PALETTES[i % BUCKET_PALETTES.length].hex;
      const dropMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(randomColor),
        roughness: 0.1,
        clearcoat: 1.0,
      });
      const mesh = new THREE.Mesh(dropletGeo, dropMat);
      mesh.position.set(
        (Math.random() - 0.5) * 11,
        (Math.random() - 0.5) * 6,
        -1.5 + (Math.random() - 0.5) * 3
      );
      mesh.scale.setScalar(0.4 + Math.random() * 0.8);
      mesh.userData = {
        basePos: mesh.position.clone(),
        speed: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      };
      scene.add(mesh);
      ambientDroplets.push(mesh);
    }

    // 7. Raycasting & Mouse Parallax
    const mouse = new THREE.Vector2(0, 0);
    const targetCameraPos = new THREE.Vector3(0, 0.6, 9.2);
    const raycaster = new THREE.Raycaster();

    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouse.x = x;
      mouse.y = y;

      // Parallax camera offset
      targetCameraPos.x = x * 0.55;
      targetCameraPos.y = 0.6 + y * 0.35;

      // Raycast for hover
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes, false);
      if (intersects.length > 0) {
        const hitCfg = intersects[0].object.userData.parentConfig;
        if (hitCfg) {
          setHoveredBucket(hitCfg.name);
          container.style.cursor = "pointer";
          return;
        }
      }
      setHoveredBucket(null);
      container.style.cursor = "default";
    };

    const handleCanvasClick = (e) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const clickMouse = new THREE.Vector2(x, y);
      raycaster.setFromCamera(clickMouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes, false);
      if (intersects.length > 0) {
        const hitCfg = intersects[0].object.userData.parentConfig;
        if (hitCfg && onColorSelect) {
          onColorSelect(hitCfg.hex);
        }
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("click", handleCanvasClick);
    container.addEventListener("touchend", handleCanvasClick);

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // 9. Animation Render Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Pause if tab is hidden
      if (document.hidden) return;

      const elapsed = clock.getElapsedTime();

      // Smooth camera parallax
      if (!prefersReducedMotion) {
        camera.position.lerp(targetCameraPos, 0.04);
        camera.lookAt(0, 0.2, 0);
      }

      // Smoothly update target bucket color if selectedColor changed
      const activeColor = new THREE.Color(activeBucketColorRef.current);
      bucketObjects.forEach((item) => {
        if (item.config.isInteractiveTarget) {
          item.bucket.liquidMat.color.lerp(activeColor, 0.08);
          item.splash.splashMat.color.lerp(activeColor, 0.08);
          if (item.brush) {
            item.brush.bristleMat.color.lerp(activeColor, 0.08);
          }
        }

        // Floating bucket harmonic motion
        if (!prefersReducedMotion) {
          const t = elapsed + item.phase;
          const floatY = Math.sin(t * 1.2) * 0.12;
          const tiltX = Math.cos(t * 0.9) * 0.05;
          const tiltZ = Math.sin(t * 1.1) * 0.04;

          item.bucket.group.position.y = item.basePos[1] + floatY;
          item.bucket.group.rotation.x = item.config.rotation[0] + tiltX;
          item.bucket.group.rotation.z = item.config.rotation[2] + tiltZ;

          item.splash.group.position.y = item.basePos[1] + floatY;
          item.splash.group.rotation.z = Math.sin(t * 0.8) * 0.03;

          if (item.brush) {
            item.brush.group.position.y = item.basePos[1] + item.config.brushOffset[1] + floatY * 1.2;
            item.brush.group.rotation.z = -0.4 + Math.sin(t * 1.4) * 0.08;
          }
        }
      });

      // Animate ambient droplets
      if (!prefersReducedMotion) {
        ambientDroplets.forEach((drop) => {
          const dt = elapsed * drop.userData.speed + drop.userData.phase;
          drop.position.y = drop.userData.basePos.y + Math.sin(dt) * 0.18;
          drop.position.x = drop.userData.basePos.x + Math.cos(dt * 0.8) * 0.08;
          drop.rotation.y += 0.01;
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Clean Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("click", handleCanvasClick);

      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m?.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[380px] sm:h-[460px] lg:h-[500px] overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/40 via-slate-950/80 to-slate-950 border border-white/10 shadow-2xl">
      {/* Three.js WebGL Mount Point */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Decorative Gradient Glows */}
      <div className="absolute -top-32 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Glassmorphic Hero Overlay Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white tracking-wider flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              DYNAMIC PAINT SYSTEM
            </span>
            <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-indigo-500/15 backdrop-blur-md border border-indigo-500/30 text-xs font-semibold text-indigo-300">
              3D PBR Studio
            </span>
          </div>

          <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[11px] text-slate-300">
            {hoveredBucket ? (
              <span className="text-cyan-300 font-medium">Click to select: {hoveredBucket}</span>
            ) : (
              <span>Interactive 3D: Click any bucket to apply color</span>
            )}
          </div>
        </div>

        {/* Center Calmer Area for Brand Headline */}
        <div className="max-w-xl mx-auto text-center space-y-2 py-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent drop-shadow-md">
            Next-Gen AI Wall Visualization
          </h2>
          <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed font-light">
            SegFormer ADE20K semantic precision meets physically based sheen, shadow preservation, and multi-wall color exploration.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/60 backdrop-blur-sm border border-white/5">
            <span className="text-cyan-400">✦</span> 99.5% Semantic Wall IoU
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/60 backdrop-blur-sm border border-white/5">
            <span className="text-pink-400">✦</span> Microfacet BRDF Sheens
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/60 backdrop-blur-sm border border-white/5">
            <span className="text-amber-400">✦</span> Solar Lighting Simulation
          </div>
        </div>
      </div>
    </div>
  );
}
