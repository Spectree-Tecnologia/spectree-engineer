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
