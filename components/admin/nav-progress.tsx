"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Top progress bar for client-side navigation.
 *
 * - Starts immediately on any internal <a> click (no router-event dependency).
 * - Stops when usePathname() changes (page has rendered).
 * - Works reliably with Next.js 16 App Router + Turbopack.
 */
export function NavProgress() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startProgress() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    setVisible(true);
    setWidth(20);
    tickRef.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 85) return w;
        // Slow down as it approaches 85%
        return w + (85 - w) * 0.08;
      });
    }, 150);
  }

  function finishProgress() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setWidth(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 350);
  }

  // Trigger on any internal link click — immediate, no async wait.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      // Skip: external, hash-only, mailto, tel, download
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank"
      )
        return;

      // Skip: same-page navigation
      const currentPath = window.location.pathname + window.location.search;
      const targetPath = href.startsWith("/") ? href : `/${href}`;
      if (targetPath === currentPath || targetPath === window.location.pathname) return;

      startProgress();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop when navigation completes.
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      finishProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    },
    []
  );

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        width: `${width}%`,
        background: "#5BC2F0",
        transition:
          width === 100
            ? "width 0.15s ease"
            : "width 0.15s ease",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
}
