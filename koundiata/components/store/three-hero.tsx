"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { BusinessSector } from "@/lib/types";

export function ThreeHeroCanvas({ sector = "cosmetique" }: { sector?: BusinessSector }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.z = 25;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Sector-specific colors and geometries
    let primaryColor = 0xc47a53; // warm rose-gold/amber for cosmetique
    let particleCount = 400;
    let particleSize = 0.22;

    if (sector === "automobile") {
      primaryColor = 0x38bdf8; // electric cyan for automotive
      particleCount = 550;
      particleSize = 0.18;
    } else if (sector === "hightech") {
      primaryColor = 0x818cf8; // neon indigo for hightech
      particleCount = 600;
      particleSize = 0.2;
    } else if (sector === "mode") {
      primaryColor = 0xd97706; // warm amber for fashion
      particleCount = 350;
      particleSize = 0.16;
    } else if (sector === "universel") {
      primaryColor = 0x2563eb; // royal blue for universel
      particleCount = 450;
      particleSize = 0.18;
    }

    // Geometry & Material for Particle Field
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const x = (Math.random() - 0.5) * 45;
      const y = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 25;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      originalPositions[idx] = x;
      originalPositions[idx + 1] = y;
      originalPositions[idx + 2] = z;
      velocities[i] = 0.2 + Math.random() * 0.8;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: primaryColor,
      size: particleSize,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Interactive Wireframe Core
    const coreGeometry =
      sector === "automobile"
        ? new THREE.TorusGeometry(7, 1.8, 16, 64)
        : sector === "hightech"
        ? new THREE.IcosahedronGeometry(7, 2)
        : sector === "mode"
        ? new THREE.OctahedronGeometry(6.5, 1)
        : new THREE.DodecahedronGeometry(6.5, 1);

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: primaryColor,
      wireframe: true,
      transparent: true,
      opacity: sector === "automobile" || sector === "hightech" ? 0.28 : 0.18,
      blending: THREE.AdditiveBlending,
    });

    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMesh.position.set(12, 0, -5);
    scene.add(coreMesh);

    // Mouse Interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 10;
      mouseY = -y * 8;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // Resize Handler
    const onResize = () => {
      if (!canvas) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvas);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth camera interpolation based on cursor
      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;
      camera.position.x = targetX;
      camera.position.y = targetY;
      camera.lookAt(0, 0, 0);

      // Rotate 3D core mesh
      coreMesh.rotation.x = elapsed * 0.12;
      coreMesh.rotation.y = elapsed * 0.18;

      // Animate particles
      const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        // subtle wave displacement
        posArray[idx + 1] =
          originalPositions[idx + 1] + Math.sin(elapsed * velocities[i] + originalPositions[idx]) * 1.5;
        posArray[idx] =
          originalPositions[idx] + Math.cos(elapsed * 0.5 * velocities[i] + originalPositions[idx + 1]) * 0.8;
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", onMouseMove);
      resizeObserver.disconnect();
      particleGeometry.dispose();
      particleMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      renderer.dispose();
    };
  }, [sector]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
        opacity: 0.85,
      }}
      aria-hidden="true"
    />
  );
}
