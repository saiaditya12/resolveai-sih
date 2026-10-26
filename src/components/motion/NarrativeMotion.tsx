"use client";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
export function NarrativeMotion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from('.principles > span', {y:14,opacity:.4,stagger:.14,scrollTrigger:{trigger:'.principles',start:'top 95%',end:'top 65%',scrub:.5}});
 const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: ".pattern-visual",
          start: "top 85%",
          end: "center 45%",
          scrub: 0.6,
        },
      });
      timeline
        .from(".complaint-slip", { x: -35, stagger: 0.12, opacity: 0.3 })
        .from(".pattern-result", { scale: 0.92, opacity: 0.4 }, 0.3);
      gsap.from(".problem-route span", {
        y: (i) => (i % 2 ? -12 : 12),
        rotation: (i) => (i % 2 ? 2 : -2),
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".problem-route",
          start: "top 85%",
          end: "bottom 50%",
          scrub: true,
        },
      });
    });
    mm.add(
      "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const lenis = new Lenis({
          lerp: 0.12,
          smoothWheel: true,
          anchors: false,
          prevent: (node) => node.tagName === "DIALOG",
        });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        const steps = gsap.utils.toArray<HTMLElement>(".journey-step");
        steps.forEach((step, index) => {
          ScrollTrigger.create({
            trigger: step,
            start: "top 58%",
            end: "bottom 58%",
            onToggle: (self) => {
              if (self.isActive) {
                document
                  .querySelectorAll(".journey-station")
                  .forEach((node, i) =>
                    node.classList.toggle("active", i <= index),
                  );
                gsap.to(".journey-parcel", {
                  top: `${8 + index * 13}%`,
                  duration: 0.45,
                  overwrite: true,
                });
                const label = document.querySelector(".journey-current");
                if (label)
                  label.textContent = `${String(index + 1).padStart(2, "0")} / ${step.dataset.title}`;
              }
            },
          });
        });
        return () => {
          gsap.killTweensOf(".journey-parcel");
          document
            .querySelectorAll(".journey-station")
            .forEach((node, i) => node.classList.toggle("active", i === 0));
          gsap.ticker.remove(tick);
          lenis.destroy();
          gsap.ticker.lagSmoothing(500, 33);
        };
      },
    );
    return () => mm.revert();
  }, []);
  return null;
}
