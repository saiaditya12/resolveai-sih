"use client";
// Project-specific adaptation of React Bits SpotlightCard; license retained alongside.
// https://github.com/DavidHDev/react-bits
import { useRef, type ReactNode } from "react";
export default function SpotlightCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="summary-spotlight"
      onPointerMove={(event) => {
        if (
          !ref.current ||
          window.matchMedia(
            "(prefers-reduced-motion: reduce), (pointer: coarse)",
          ).matches
        )
          return;
        const box = ref.current.getBoundingClientRect();
        ref.current.style.setProperty(
          "--spot-x",
          `${event.clientX - box.left}px`,
        );
        ref.current.style.setProperty(
          "--spot-y",
          `${event.clientY - box.top}px`,
        );
      }}
    >
      {children}
    </div>
  );
}
