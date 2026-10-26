"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
const links = [
  ["How it works", "how-it-works"],
  ["Intelligence", "intelligence"],
  ["For students", "students"],
  ["For AICTE", "officers"],
];
export function Navigation() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    const media = window.matchMedia("(min-width: 1100px)");
    const resize = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", resize);
    return () => {
      window.removeEventListener("keydown", close);
      media.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <header className="site-header">
      <a className="brand" href="#" aria-label={`${site.name} home`}>
        <span className="brand-mark" aria-hidden="true">
          r<span>↗</span>
        </span>
        {site.name}
        <span className="brand-tag">/ civic intelligence</span>
      </a>
      <button
        ref={toggle}
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="main-nav"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close −" : "Menu +"}
      </button>
      <nav
        id="main-nav"
        className={open ? "navigation is-open" : "navigation"}
        aria-label="Main navigation"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {links.map(([label, id]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
        <a className="nav-track" href="#students">
          Track complaint ↗
        </a>
        <Link className="button primary small" href="/login">
          Raise complaint <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}
