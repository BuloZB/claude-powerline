import { darkTheme, darkAnsi256Theme, darkAnsiTheme } from "./dark";
import { lightTheme, lightAnsi256Theme, lightAnsiTheme } from "./light";
import { nordTheme, nordAnsi256Theme, nordAnsiTheme } from "./nord";
import {
  tokyoNightTheme,
  tokyoNightAnsi256Theme,
  tokyoNightAnsiTheme,
} from "./tokyo-night";
import {
  rosePineTheme,
  rosePineAnsi256Theme,
  rosePineAnsiTheme,
} from "./rose-pine";

export interface SegmentColor {
  bg: string;
  fg: string;
}

export interface ColorTheme {
  directory: SegmentColor;
  git: SegmentColor;
  model: SegmentColor;
  session: SegmentColor;
  block: SegmentColor;
  today: SegmentColor;
  tmux: SegmentColor;
  context: SegmentColor;
  metrics: SegmentColor;
  version: SegmentColor;
}

export interface PowerlineColors {
  reset: string;
  modeBg: string;
  modeFg: string;
  gitBg: string;
  gitFg: string;
  modelBg: string;
  modelFg: string;
  sessionBg: string;
  sessionFg: string;
  blockBg: string;
  blockFg: string;
  todayBg: string;
  todayFg: string;
  tmuxBg: string;
  tmuxFg: string;
  contextBg: string;
  contextFg: string;
  metricsBg: string;
  metricsFg: string;
  versionBg: string;
  versionFg: string;
}

export const BUILT_IN_THEMES: Record<string, ColorTheme> = {
  dark: darkTheme,
  "dark-ansi256": darkAnsi256Theme,
  "dark-ansi": darkAnsiTheme,
  light: lightTheme,
  "light-ansi256": lightAnsi256Theme,
  "light-ansi": lightAnsiTheme,
  nord: nordTheme,
  "nord-ansi256": nordAnsi256Theme,
  "nord-ansi": nordAnsiTheme,
  "tokyo-night": tokyoNightTheme,
  "tokyo-night-ansi256": tokyoNightAnsi256Theme,
  "tokyo-night-ansi": tokyoNightAnsiTheme,
  "rose-pine": rosePineTheme,
  "rose-pine-ansi256": rosePineAnsi256Theme,
  "rose-pine-ansi": rosePineAnsiTheme,
};

export function getTheme(
  themeName: string,
  colorSupport?: "none" | "ansi" | "ansi256" | "truecolor"
): ColorTheme | null {
  const baseTheme = BUILT_IN_THEMES[themeName];
  if (!baseTheme) return null;

  if (colorSupport === "none" || colorSupport === "ansi") {
    const ansiVariant = BUILT_IN_THEMES[`${themeName}-ansi`];
    if (ansiVariant) return ansiVariant;
  }

  if (colorSupport === "ansi256") {
    const ansi256Variant = BUILT_IN_THEMES[`${themeName}-ansi256`];
    if (ansi256Variant) return ansi256Variant;
  }

  return baseTheme;
}

export {
  darkTheme,
  darkAnsi256Theme,
  darkAnsiTheme,
  lightTheme,
  lightAnsi256Theme,
  lightAnsiTheme,
  nordTheme,
  nordAnsi256Theme,
  nordAnsiTheme,
  tokyoNightTheme,
  tokyoNightAnsi256Theme,
  tokyoNightAnsiTheme,
  rosePineTheme,
  rosePineAnsi256Theme,
  rosePineAnsiTheme,
};
