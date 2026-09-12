"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "atlas.theme";
const PRESENT_KEY = "atlas.present";

/** Inline script run before first paint — reads localStorage theme, defaults to light if not set (ignores OS dark mode). */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="dark"){t="light"}document.documentElement.setAttribute("data-theme",t);if(localStorage.getItem("${PRESENT_KEY}")==="1"){document.documentElement.setAttribute("data-present","1")}}catch(e){}})();`;

let activeTheme: Theme = "light";
let activePresent: boolean = false;

if (typeof window !== "undefined") {
  try {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") {
      activeTheme = attr as Theme;
    } else {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "dark" || stored === "light") {
        activeTheme = stored as Theme;
      }
    }
    activePresent =
      document.documentElement.getAttribute("data-present") === "1" ||
      window.localStorage.getItem(PRESENT_KEY) === "1";
  } catch {
    /* storage unavailable */
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readTheme(): Theme {
  return activeTheme;
}
function readPresent(): boolean {
  return activePresent;
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function usePrefs() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const present = useSyncExternalStore(subscribe, readPresent, () => false);

  const setTheme = useCallback((t: Theme) => {
    activeTheme = t;
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.style.colorScheme = t;
    }
    save(THEME_KEY, t);
    emit();
  }, []);

  const setPresent = useCallback((p: boolean) => {
    activePresent = p;
    if (typeof document !== "undefined") {
      if (p) document.documentElement.setAttribute("data-present", "1");
      else document.documentElement.removeAttribute("data-present");
    }
    save(PRESENT_KEY, p ? "1" : "0");
    emit();
  }, []);

  return { theme, setTheme, present, setPresent };
}
