import { z } from "zod";

// The portal accepts English (plain ASCII) text only. Typographic characters
// that word processors and phones insert automatically are converted to their
// plain equivalents first, so a pasted "Buyer’s" or "3–6" is not rejected.
const TYPOGRAPHIC: [RegExp, string][] = [
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[‐-―−]/g, "-"],
  [/…/g, "..."],
  [/[  -   　]/g, " "],
  [/[​-‍﻿]/g, ""],
];

export function toPlainText(s: string) {
  let out = s.normalize("NFC");
  for (const [re, rep] of TYPOGRAPHIC) out = out.replace(re, rep);
  return out;
}

/** Trims and collapses runs of spaces/tabs (keeps line breaks for multi-line fields). */
const tidy = (s: string, multiline = false) =>
  multiline
    ? toPlainText(s).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : toPlainText(s).replace(/\s+/g, " ").trim();

const ENGLISH = /^[\x20-\x7E\n]*$/;
export const ENGLISH_ONLY_MSG = "Use English characters only.";

const upperFirst = (w: string) =>
  w.toLowerCase().replace(/(^|[-'(/.])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());

/** "sujith  KUMAR" → "Sujith Kumar". */
export function personCase(s: string) {
  return tidy(s).split(" ").map(upperFirst).join(" ");
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

// Business abbreviations kept in capitals even when typed in lower case.
const ABBREVIATIONS = new Set([
  "llc", "llp", "plc", "fze", "fzc", "fzco", "fzllc", "bv", "nv", "sa", "ag",
  "srl", "spa", "jsc", "wll", "uae", "usa", "uk", "eu", "gcc", "b2b", "fmcg", "it", "hr",
  "ceo", "cfo", "coo", "cto", "cpo", "md", "gm", "agm", "dgm", "vp", "svp", "evp", "avp", "mm",
]);

/**
 * Title case for organisation names and designations, whatever case the user
 * typed in. Joining words stay lower-case and known abbreviations stay in
 * capitals. In mixed-case input, short all-capital words (ABC, DHL) and
 * names like McDonald are kept as typed.
 *   "gulf fresh trading llc" → "Gulf Fresh Trading LLC"
 *   "test BUYER 1"           → "Test Buyer 1"
 *   "THE TEA COMPANY"        → "The Tea Company"
 *   "head of procurement"    → "Head of Procurement"
 *   "ABC Exports"            → "ABC Exports"
 */
export function titleCase(s: string) {
  const t = tidy(s);
  const mixed = t !== t.toUpperCase() && t !== t.toLowerCase();
  return t
    .split(" ")
    .map((w, i) => {
      const lower = w.toLowerCase();
      const bare = lower.replace(/[^a-z0-9]/g, "");
      if (ABBREVIATIONS.has(bare)) return w.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      if (mixed && (/^[A-Z]{2,4}$/.test(w) || /^(Mc|Mac)[A-Z][a-z]+$/.test(w))) return w;
      return upperFirst(w);
    })
    .join(" ");
}

// ---------------------------------------------------------------- zod fields

type Opts = { min?: number; max: number; label: string; multiline?: boolean };

/** Free text in English; optional unless min is given. */
export function englishText({ min = 0, max, label, multiline }: Opts) {
  return z
    .string()
    .transform((v) => tidy(v, multiline))
    .pipe(
      z
        .string()
        .max(max, `${label} must be at most ${max} characters.`)
        .refine((v) => ENGLISH.test(v), `${label}: ${ENGLISH_ONLY_MSG}`)
        .refine((v) => v.length >= min, min > 1 ? `Enter ${label.toLowerCase()} (at least ${min} characters).` : `Enter ${label.toLowerCase()}.`),
    );
}

/** Contact person name — letters and spaces only, stored in Title Case. */
export function personName(label = "Name") {
  return z
    .string()
    .transform((v) => tidy(v))
    .pipe(
      z
        .string()
        .min(2, `Enter the ${label.toLowerCase()}.`)
        .max(120)
        .regex(/^[A-Za-z ]+$/, `${label}: use English letters and spaces only — no numbers or special characters.`),
    )
    .transform(personCase);
}

/** Buyer / organisation name — letters, numbers and . , & ' ( ) / - */
export function orgName(label = "Name of the buyer") {
  return z
    .string()
    .transform((v) => tidy(v))
    .pipe(
      z
        .string()
        .min(2, `Enter the ${label.toLowerCase()}.`)
        .max(160)
        .regex(/^[A-Za-z0-9 .,&'()/-]+$/, `${label}: use English letters, numbers and . , & ' ( ) / - only.`)
        .regex(/[A-Za-z]/, `${label} must contain letters.`),
    )
    .transform(titleCase);
}

/** Job title — letters, numbers and . , & ( ) / - */
export function designation(label = "Designation") {
  return z
    .string()
    .transform((v) => tidy(v))
    .pipe(
      z
        .string()
        .min(2, `Enter the ${label.toLowerCase()}.`)
        .max(120)
        .regex(/^[A-Za-z0-9 .,&()/-]+$/, `${label}: use English letters, numbers and . , & ( ) / - only.`)
        .regex(/[A-Za-z]/, `${label} must contain letters.`),
    )
    .transform(titleCase);
}

/** E-mail address in plain English characters, stored lower-case. */
export function emailField(msg = "Enter a valid e-mail address, e.g. name@company.com.") {
  return z
    .string()
    .transform((v) => toPlainText(v).trim().toLowerCase())
    .pipe(z.email(msg).max(160).regex(/^[\x21-\x7E]+$/, msg));
}

/** Mobile number with country code; stored with single spaces. */
export function mobileField() {
  return z
    .string()
    .transform((v) => toPlainText(v).replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Enter a valid mobile number using digits only, with country code, e.g. +971 50 123 4567."),
    );
}

/** Maps validation issues to { field: message }, keeping the first message per field. */
export function firstErrors(e: z.ZodError, joinPath = false) {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const key = joinPath ? i.path.join(".") : String(i.path[0]);
    out[key] ??= i.message;
  }
  return out;
}

/** Place names (taluk, local body) — English letters, spaces, . and -; Title Case. */
export function placeName(label: string) {
  return z
    .string()
    .transform((v) => tidy(v))
    .pipe(
      z
        .string()
        .min(2, `Enter the ${label.toLowerCase()}.`)
        .max(80)
        .regex(/^[A-Za-z][A-Za-z .-]*$/, `${label}: use English letters, spaces, . and - only.`),
    )
    .transform(titleCase);
}

/** Udyam Registration Number of a Kerala MSME: UDYAM-KL-00-0000000. */
export function udyamField() {
  return z
    .string()
    .transform((v) => toPlainText(v).toUpperCase().replace(/\s+/g, "").replace(/[–—_]/g, "-"))
    .pipe(
      z
        .string()
        .regex(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/, "Enter the Udyam number in the format UDYAM-KL-00-0000000.")
        .regex(/^UDYAM-KL-/, "Only Kerala Udyam numbers (UDYAM-KL-…) can be registered."),
    );
}

/** Indian mobile number; stored as 10 digits. Accepts +91 / 0 prefixes and spaces. */
export function indianMobile(label = "Mobile number") {
  return z
    .string()
    .transform((v) => toPlainText(v).replace(/[\s()-]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, `${label}: enter a valid 10-digit Indian mobile number.`));
}

/** 9876543210 → +91 98765 43210 */
export const fmtMobile = (m?: string | null) => (m && /^\d{10}$/.test(m) ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : m ?? "");
