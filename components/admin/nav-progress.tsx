"use client";

import { AppProgressBar as ProgressBar } from "next-nprogress-bar";

export function NavProgress() {
  return (
    <ProgressBar
      height="2px"
      color="#5BC2F0"
      options={{ showSpinner: false, minimum: 0.15, trickleSpeed: 200 }}
      shallowRouting
    />
  );
}
