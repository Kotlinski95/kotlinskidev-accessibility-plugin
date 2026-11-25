import { createSvg } from "../dom";

const PATH_PATTERN = /^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]{1,1500}$/;
const FLIPPED_ICONS: ReadonlySet<string> = new Set([
  "textAlign",
  "bigCursor",
  "readingLine",
  "chevron",
]);

export type IconFactory = (name: string) => SVGSVGElement | null;

export const createIconFactory =
  (doc: Document, icons: Record<string, string>): IconFactory =>
  (name) => {
    const pathData = icons[name];
    if (typeof pathData !== "string" || !PATH_PATTERN.test(pathData))
      return null;
    const svg = createSvg(doc, pathData);
    if (FLIPPED_ICONS.has(name)) svg.setAttribute("data-flip", "");
    return svg;
  };

export const iconChildren = (icon: SVGSVGElement | null): SVGSVGElement[] =>
  icon ? [icon] : [];
