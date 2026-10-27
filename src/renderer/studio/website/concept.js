/* Concept (#229): the big idea a Website Job is built around, settled before Story (Website Build Pipeline, 2026-10-27).
 * One line named as a place or feeling ("a roof that shrugs off the rain"), the audience, one goal, 3 reference sites
 * and a few mood words. Jax approves it. Core lane, pure: cleanConcept() checks the shape, conceptGaps() lists what's missing. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianConcept = api;
})(typeof window === 'undefined' ? null : window, function () {
  const LIMITS = Object.freeze({ line: 140, audience: 200, goal: 200, url: 300, note: 160, references: 3, mood: 6, word: 30 });
  const PLACEHOLDER = /\b(tbd|todo|lorem ipsum|placeholder|xxx)\b|\{\{|\}\}/i;
  const URL = /^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/[^\s<>"]*)?$/;
  const MOOD = /^[A-Za-z][A-Za-z -]*$/;

  const text = (value, field, max) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error(`${field} must be text.`);
    if (value.length > max) throw new Error(`${field} is too long (max ${max} characters).`);
    return value.trim();
  };
  const list = (value, field, max) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${field} must be a list.`);
    if (value.length > max) throw new Error(`${field}: at most ${max}.`);
    return value;
  };

  /** A clean copy of a concept, or an error naming the field. Unknown fields are dropped. */
  function cleanConcept(input) {
    const c = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const references = list(c.references, 'Reference sites', LIMITS.references).map((r, i) => {
      const ref = r && typeof r === 'object' ? r : {};
      const url = text(ref.url, `Reference site ${i + 1} link`, LIMITS.url);
      if (url && !URL.test(url)) throw new Error(`Reference site ${i + 1}: use a full https:// link.`);
      return { url, note: text(ref.note, `Reference site ${i + 1} note`, LIMITS.note) };
    }).filter(r => r.url || r.note);
    const mood = list(c.mood, 'Mood words', LIMITS.mood).map((w, i) => {
      const word = text(w, `Mood word ${i + 1}`, LIMITS.word);
      if (word && !MOOD.test(word)) throw new Error(`Mood word ${i + 1}: letters, spaces and dashes only.`);
      return word.toLowerCase();
    }).filter(Boolean);
    return { line: text(c.line, 'Concept line', LIMITS.line), audience: text(c.audience, 'Audience', LIMITS.audience),
      goal: text(c.goal, 'Goal', LIMITS.goal), references, mood: [...new Set(mood)] };
  }

  /** What the Concept gate still needs: [{ field, message }]. Empty = ready for Jax. */
  function conceptGaps(concept) {
    const c = concept || {}, gaps = [];
    const need = (field, message) => gaps.push({ field, message });
    if (!c.line) need('line', 'Write the concept line: the big idea, named as a place or feeling.');
    if (!c.audience) need('audience', 'Say who the site is for.');
    if (!c.goal) need('goal', 'Name the one goal.');
    const refs = (c.references || []).filter(r => r.url);
    if (refs.length < LIMITS.references) need('references', `Add ${LIMITS.references} reference sites (${refs.length} so far).`);
    if ((c.references || []).some(r => r.url && !r.note)) need('references', 'Say what you like about each reference site.');
    if ((c.mood || []).length < 3) need('mood', `Add at least 3 mood words (${(c.mood || []).length} so far).`);
    if (PLACEHOLDER.test(`${c.line} ${c.audience} ${c.goal}`)) need('line', 'Replace the placeholder text.');
    return gaps;
  }

  return Object.freeze({ LIMITS, cleanConcept, conceptGaps });
});
