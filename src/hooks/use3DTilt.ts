"use client";

import { useCallback, useEffect, useRef } from "react";

interface Use3DTiltOptions {
  intensity?: number;
  perspective?: number;
  scale?: number;
  speed?: number;
  disabled?: boolean;
}

export function use3DTilt({
  intensity = 10,
  perspective = 1000,
  scale = 1.02,
  speed = 400,
  disabled = false,
}: Use3DTiltOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (disabled || !ref.current) return;

      cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const element = ref.current;
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -intensity;
        const rotateY = ((x - centerX) / centerX) * intensity;

        element.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;
        element.style.transition = `transform ${speed}ms ease-out`;
      });
    },
    [disabled, intensity, perspective, scale, speed]
  );

  const handleMouseLeave = useCallback(() => {
    if (!ref.current) return;

    cancelAnimationFrame(rafRef.current);
    ref.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    ref.current.style.transition = "transform 500ms ease-out";
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    element.addEventListener("mousemove", handleMouseMove, { passive: true });
    element.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [disabled, handleMouseMove, handleMouseLeave]);

  return ref;
}
