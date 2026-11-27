// Types of scripts/artboard.mjs, for a TypeScript spec that imports it.
import type { Locator, Page } from '@playwright/test';

export interface ArtboardProbe {
  name: string;
  /** selector inside the artboard's root */
  design: string;
  /** selector inside the screen's root */
  app: string;
  /** properties or keys (text, left, top, width, height, textLeft, textTop, textWidth, textHeight, count) not compared for this probe */
  without?: string[];
}

export interface ArtboardExclusion {
  properties: string[];
  why: string;
  /** a probe's name, or 'root'; every probe when left out */
  probe?: string;
}

export const NOT_STYLE: { why: string; match: RegExp }[];

/** two computed values are the same: a px length within 0.5, any other number within 0.01, the rest as written */
export function sameValue(a: string | undefined, b: string | undefined): boolean;

export function compareArtboard(
  page: Page,
  options: {
    artboard: string;
    designRoot: string;
    appRoot: Locator | string;
    probes?: ArtboardProbe[];
    exclude?: ArtboardExclusion[];
    colorScheme?: 'light' | 'dark';
    viewport?: { width: number; height: number };
  },
): Promise<{ differences: string[]; uncovered: string[] }>;
