export const toUpperCase = (v: string) => v.toUpperCase();

export const toLowerCase = (v: string) => v.toLowerCase();

export const toTitleCase = (v: string) =>
  v
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

export const toSectionLetter = (v: string) =>
  v.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();

export const preserve = (v: string) => v;

export type InputFormatter = (v: string) => string;
