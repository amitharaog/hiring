// Splits a CV into personal details (kept in our database) and anonymised
// content (the only thing any AI step ever sees). Deliberately deterministic
// regex code, not an LLM: the identifier must never reach a model, not even
// the one that would otherwise be asked to find it.

export type PersonalDetails = { name: string; email: string; phone: string };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A run of digits that starts like an Indian mobile (+91 or 6-9) and is 10-26 digits long: one number, or
// the same number twice when a PDF doubles its header glyphs. Years and date ranges start with 1-2 and don't match.
const PHONE_RUN = /(?:\+\s?\d{1,3}[\s.-]?)?[6-9]\d{2,4}[\s.()-]?\d{3,5}(?:[\s.()-]?\+?\d{2,5}){0,5}(?!\d)/g;
const MOBILE = /(?:\+\s?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}/;
const ANY_URL = /\b(?:https?:\/\/|www\.)[^\s|·,;)]+/gi;
const PROFILE_URL =
  /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|leetcode\.com|gitlab\.com|twitter\.com|x\.com|behance\.net|dribbble\.com|medium\.com|kaggle\.com)(?:\/[^\s|·,;]*)?/gi;

// Words that can appear alone on a CV's first line without being a name.
const NOT_A_NAME = new Set(
  (
    "product manager senior lead engineer developer analyst associate director head resume curriculum vitae cv " +
    "summary profile experience education skills marketing sales operations customer success growth software " +
    "strategic strategy executive consultant intern officer specialist principal staff vice president chief"
  ).split(" "),
);

function digits(s: string) {
  return s.replace(/\D/g, "");
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "02_priya_sharma.pdf" / "spm_17_nalini_iyer.pdf" -> "Priya Sharma". Null if the filename isn't name-like. */
export function nameFromFilename(fileName: string): string | null {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "");
  const tokens = base
    .split(/[^A-Za-z]+/)
    .filter((t) => t.length > 1)
    .filter((t) => !/^(pm|spm|cv|resume|resumes|final|new|copy|updated|draft|product|manager|senior|v)$/i.test(t));
  return tokens.length >= 2 && tokens.length <= 4 ? titleCase(tokens.join(" ")) : null;
}

/** First line that looks like a person's name (2-4 capitalised words, nothing else). */
function nameFromText(text: string): string | null {
  for (const raw of text.split("\n").slice(0, 6)) {
    const line = raw.trim();
    if (!/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(line)) continue;
    if (line.split(/\s+/).some((w) => NOT_A_NAME.has(w.toLowerCase()))) continue;
    return line;
  }
  return null;
}

export function splitPersonalDetails(rawText: string, fileName: string) {
  const text = rawText.replace(/\r/g, "");
  // Doubled header glyphs can glue the name onto the email ("REDDYsquad_5@x.com").
  const email = ((text.match(EMAIL) ?? [])[0] ?? "").replace(/^[A-Z]{3,}(?=[a-z_])/, "").toLowerCase();
  const isPhone = (m: string) => digits(m).length >= 10 && digits(m).length <= 26;
  const phoneRun = (text.match(PHONE_RUN) ?? []).find(isPhone);
  const phone = (phoneRun?.match(MOBILE)?.[0] ?? "").trim();
  const name = nameFromFilename(fileName) ?? nameFromText(text) ?? "";

  let content = text.replace(EMAIL, "[EMAIL]").replace(PROFILE_URL, "[LINK]").replace(ANY_URL, "[LINK]");
  content = content
    .replace(PHONE_RUN, (m) => (isPhone(m) ? "[PHONE]" : m))
    .replace(new RegExp(MOBILE.source, "g"), "[PHONE]"); // catches a number the run match missed
  // Every spelling of the name, and each part of it (first name, surname).
  const parts = [name, ...name.split(/\s+/)].filter((p) => p.length >= 3);
  for (const p of parts) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Long parts also match inside run-together header text ("PRIYASharma"); short ones need word edges.
    content = content.replace(new RegExp(p.length >= 5 ? esc : `\\b${esc}\\b`, "gi"), "[NAME]");
  }
  content = content
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return { personal: { name, email, phone } satisfies PersonalDetails, content };
}
