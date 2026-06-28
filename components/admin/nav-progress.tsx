"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavProgress() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startProgress() {
    if (hideRef.current) clearTimeout(hideRef.current);
    setLeaving(false);
    setVisible(true);
  }

  function finishProgress() {
    setLeaving(true);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setLeaving(false);
    }, 280);
  }

  // Trigger on any internal link click - immediate, capture phase.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
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
      const currentPath = window.location.pathname + window.location.search;
      const targetPath = href.startsWith("/") ? href : `/${href}`;
      if (targetPath === currentPath || targetPath === window.location.pathname) return;
      startProgress();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Stop when navigation completes.
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      finishProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(
    () => () => {
      if (hideRef.current) clearTimeout(hideRef.current);
    },
    []
  );

  if (!visible) return null;

  const animIn = !leaving;

  return (
    <>
      <style>{`
        @keyframes np-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes np-spin-reverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes np-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes np-overlay-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes np-card-in {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes np-card-out {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.94); }
        }
        @keyframes np-pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.96); }
          50%       { opacity: 1;   transform: scale(1.04); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 21, 69, 0.35)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: animIn
            ? "np-overlay-in 0.18s ease forwards"
            : "np-overlay-out 0.28s ease forwards",
        }}
      />

      {/* Centering wrapper - keeps the card centered regardless of the card's
          own animation transform (which would otherwise override translate). */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
      {/* Card */}
      <div
        aria-label="טוען"
        role="status"
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "32px 40px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          boxShadow:
            "0 24px 64px rgba(10, 21, 69, 0.22), 0 4px 20px rgba(0,0,0,0.06)",
          animation: animIn
            ? "np-card-in 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards"
            : "np-card-out 0.25s ease forwards",
        }}
      >
        {/* Accent line top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "48px",
            height: "3px",
            borderRadius: "0 0 3px 3px",
            background: "linear-gradient(90deg, #5BC2F0, #1E2D7D)",
          }}
        />

        {/* Spinner rings */}
        <div style={{ position: "relative", width: 52, height: 52 }}>
          {/* Outer ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid #E8F6FD",
              borderTopColor: "#5BC2F0",
              animation: "np-spin 0.8s linear infinite",
            }}
          />
          {/* Inner ring - counter-rotate, navy */}
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: "50%",
              border: "2px solid #EEF0F9",
              borderBottomColor: "#1E2D7D",
              animation: "np-spin-reverse 1.2s linear infinite",
            }}
          />
          {/* Center dot */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 7,
              height: 7,
              marginTop: -3.5,
              marginLeft: -3.5,
              borderRadius: "50%",
              background: "#5BC2F0",
              animation: "np-pulse 1.2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Label */}
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#6B7280",
            fontFamily: "var(--font-heebo, sans-serif)",
            letterSpacing: "0.01em",
          }}
        >
          טוען...
        </span>
      </div>
      </div>
    </>
  );
}
