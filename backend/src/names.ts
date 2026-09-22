// Matching a student's name across what they typed at signup, their UNB email and their
// transcript. Names come with accents, hyphens, apostrophes and typos, so words are
// normalized and compared with a small edit-distance allowance.
import { distance } from "fastest-levenshtein";

interface Name {
  given: string[];
  surname: string[];
}

// "José O'Brien-Smith" -> ["jose", "obrien", "smith"]
function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// the transcript prints "Lastname, Firstnames"
function parsePrinted(printed: string): Name {
  const [surname = "", given = ""] = printed.split(",");
  return { given: words(given), surname: words(surname) };
}

// one typo in a short word, two in a long one, none in very short ones
function similar(a: string, b: string): boolean {
  const len = Math.min(a.length, b.length);
  const allowed = len >= 8 ? 2 : len >= 4 ? 1 : 0;
  return distance(a, b) <= allowed;
}

// "Oganja, Maurya Kiritkumar" -> "Maurya Kiritkumar Oganja"
export function fullName(printed: string): string {
  const [surname = "", given = ""] = printed.split(",").map((s) => s.trim());
  return given ? `${given} ${surname}` : surname;
}

// Does the name typed at signup belong to the transcript's name? It needs the surname and
// at least one given name, in any order, and nothing that isn't on the transcript.
export function nameMatches(entered: string, printed: string): boolean {
  const name = parsePrinted(printed);
  const typed = words(entered);
  const surname = name.surname.join("");
  const known = [...name.given, ...name.surname, surname];

  // a multi-word surname can be typed as one word or several
  const hasSurname = typed.some((w) => similar(w, surname)) || name.surname.every((s) => typed.some((w) => similar(w, s)));
  const hasGiven = name.given.length === 0 || typed.some((w) => name.given.some((g) => similar(w, g)));
  const allKnown = typed.every((w) => known.some((k) => similar(w, k)));
  return hasSurname && hasGiven && allKnown;
}

// UNB student emails are "givennames.surname@unb.ca", with the given names run together
// and sometimes a number on the end. Emails in any other shape can't be judged, so they pass.
export function emailMatches(email: string, printed: string): boolean {
  const local = email.split("@")[0]!.replace(/\d+$/, "");
  const parts = local.split(".").map((p) => words(p).join(""));
  if (parts.length < 2 || parts.some((p) => !p)) return true;

  const name = parsePrinted(printed);
  const emailSurname = parts.at(-1)!;
  const emailGiven = parts.slice(0, -1).join("");
  const given = name.given.join("");

  const surnameOk = similar(emailSurname, name.surname.join("")) || name.surname.some((s) => similar(emailSurname, s));
  // the whole run of given names, just one of them, or a shortened start ("m.oganja")
  const givenOk =
    name.given.length === 0 || similar(emailGiven, given) || name.given.some((g) => similar(emailGiven, g)) || given.startsWith(emailGiven);
  return surnameOk && givenOk;
}
