"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  phase: number;
}

/**
 * Latent Knowledge Graph — floating data nodes and neural filaments representing
 * the RAG knowledge retrieval space. Pure monochrome, calm drift, interactive.
 * Automatically unmounts when the conversation starts.
 */
export function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];

    // Track mouse coordinates relative to canvas
    const mouse = { x: -1000, y: -1000, active: false };

    // Detect theme
    const isDark = () => document.documentElement.classList.contains("dark");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Node density based on screen size
      const count = width < 640 ? 28 : width < 1024 ? 42 : 55;
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 1.4 + 1.1,
        baseAlpha: Math.random() * 0.35 + 0.35,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    resize();

    const maxDist = 135;
    const mouseDist = 160;

    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const dark = isDark();
      // Monochrome color palettes
      // Dark mode: crisp white/near-white particles
      // Light mode: deep neutral particles
      const rgb = dark ? "250, 250, 250" : "23, 23, 23";

      time += 0.02;

      // Update node positions
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        // Wrap around bounds with soft padding
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;

        // Soft mouse influence
        if (mouse.active) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouseDist && dist > 0) {
            const force = (mouseDist - dist) / mouseDist;
            n.x += (dx / dist) * force * 0.6;
            n.y += (dy / dist) * force * 0.6;
          }
        }
      }

      // Draw connection filaments between nearby nodes
      ctx.lineWidth = 0.75;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDist) {
            const filamentAlpha = (1 - dist / maxDist) * (dark ? 0.22 : 0.16);
            ctx.strokeStyle = `rgba(${rgb}, ${filamentAlpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // Connection to mouse cursor
        if (mouse.active) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouseDist) {
            const mAlpha = (1 - dist / mouseDist) * (dark ? 0.3 : 0.22);
            ctx.strokeStyle = `rgba(${rgb}, ${mAlpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        // Gentle breathing pulse
        const pulse = Math.sin(time + n.phase) * 0.15;
        const alpha = Math.max(0.1, Math.min(0.9, n.baseAlpha + pulse));

        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
