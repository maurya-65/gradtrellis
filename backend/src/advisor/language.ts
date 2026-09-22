// Tidies a question before it's read: fixes spelling against a vocabulary and spells out
// common shorthand. Grammar needs no fixing: the rules look for words, and the search compares
// meaning.
import { distance } from "fastest-levenshtein";

// Question words the course descriptions rarely use. Without them a correctly spelled question
// word would look unknown and get "fixed" into some course word.
export const QUESTION_WORDS = [
  "what", "which", "when", "where", "who", "why", "how", "can", "could", "should", "would", "will", "does", "have",
  "taking", "take", "took", "want", "wanna", "like", "love", "enjoy", "interested", "into", "about", "anything",
  "recommend", "recommendation", "suggest", "suggestion", "graduate", "graduation", "eligible", "allowed", "ready",
  "prerequisite", "prerequisites", "requirement", "requirements", "remaining", "left", "progress", "track", "finish",
  "semester", "winter", "summer", "fall", "autumn", "next", "course", "courses", "class", "classes", "elective",
  "electives", "degree", "program", "honours", "honors", "minor", "major", "hello", "thanks", "please", "tell", "explain",
  "really", "maybe", "something", "stuff", "specialization", "specialisation", "specialize", "specialise",
];

// Short words are left alone: too many real words sit one letter apart.
const MIN_LENGTH = 5;

// every letter of the typed word, in order, appears in the candidate
function hasInOrder(typed: string, candidate: string): boolean {
  let i = 0;
  for (const ch of candidate) if (ch === typed[i]) i++;
  return i === typed.length;
}

// Returns a function that replaces each unknown word with the closest known word that starts with
// the same letter (typos rarely change the first one), within one edit for short words and two for
// longer ones. Ties go, in order, to a word the typed one is missing letters from (the commonest
// typo: "realy" is "really", not "ready"), to a preferred word (students type question words far
// more than calendar words), then to the more common word.
export function speller(texts: Iterable<string>, preferred: Iterable<string> = []): (text: string) => string {
  const counts = new Map<string, number>();
  for (const text of texts) for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  // above any real count
  for (const word of preferred) counts.set(word, Number.MAX_SAFE_INTEGER);

  const byFirstLetter = new Map<string, string[]>();
  for (const word of counts.keys()) {
    if (word.length < MIN_LENGTH - 2) continue;
    const list = byFirstLetter.get(word[0]!) ?? [];
    list.push(word);
    byFirstLetter.set(word[0]!, list);
  }

  const fix = (word: string): string => {
    if (word.length < MIN_LENGTH || counts.has(word)) return word;
    const allowed = word.length <= 6 ? 1 : 2;
    const close = (byFirstLetter.get(word[0]!) ?? [])
      .filter((c) => Math.abs(c.length - word.length) <= allowed)
      .map((c) => ({ word: c, edits: distance(word, c) }))
      .filter((c) => c.edits <= allowed);
    close.sort(
      (a, b) =>
        a.edits - b.edits ||
        Number(hasInOrder(word, b.word)) - Number(hasInOrder(word, a.word)) ||
        counts.get(b.word)! - counts.get(a.word)!,
    );
    return close[0]?.word ?? word;
  };

  return (text) => text.replace(/[a-z]+/g, fix);
}

const SHORTHAND: Array<[RegExp, string]> = [
  [/\bml\b/g, "machine learning"],
  [/\bai\b/g, "artificial intelligence"],
  [/\bnlp\b/g, "natural language processing"],
  [/\bcv\b/g, "computer vision"],
  [/\bweb ?dev\b/g, "web development"],
  [/\bgame ?dev\b/g, "game development"],
  [/\bdbs?\b/g, "databases"],
  [/\bos\b/g, "operating systems"],
  [/\bhci\b/g, "human computer interaction"],
  [/\biot\b/g, "internet of things"],
  [/\bcyber\b/g, "cybersecurity"],
  [/\bcrypto\b/g, "cryptography"],
  [/\balgos?\b/g, "algorithms"],
  [/\bprereqs?\b/g, "prerequisites"],
  [/\bsem\b/g, "semester"],
];

export function expandShorthand(text: string): string {
  return SHORTHAND.reduce((t, [pattern, full]) => t.replace(pattern, full), text);
}
