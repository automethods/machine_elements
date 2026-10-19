"use strict";

(function exposeI18n(root) {
  const storageKey = "motion-lab-language";
  const ukrainian = /[А-Яа-яІіЇїЄєҐґ]/;
  const ignored = "script, style, noscript, textarea, pre, code, math, .math, .math-inline-symbol, .sym, mjx-container, mjx-assistive-mml, svg metadata, [data-source-citation], [translate='no'], [data-i18n='off']";
  const translatedAttributes = ["alt", "title", "aria-label", "placeholder"];
  const attributeSelector = "[alt], [title], [aria-label], [placeholder], meta[name='description'][content]";
  const attributesFor = element => element.matches("meta[name='description']") ? [...translatedAttributes, "content"] : translatedAttributes;
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const documentLanguages = new WeakMap();
  const normalize = value => String(value).replace(/\s+/g, " ").trim();
  const supported = value => /^en(?:-|$)/i.test(String(value)) ? "en" : "uk";
  // These are the same inline symbol shapes rendered as .math-inline-symbol
  // by the publication. Pairing prose around them also covers MathJax splits.
  const protectedMath = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|(?<![\p{L}\p{N}_./\\-])(?:\p{L}_(?:\{(?:[^{}]|\{[^{}]*\})*\}|[\p{L}0-9]+)(?:\^[+-]?[\p{L}0-9]+)?|λст)(?![\p{L}\p{N}_/\\^]|[.-][\p{L}\p{N}])|\\(?:mathrm|text|operatorname)\s*\{(?:[^{}]|\{[^{}]*\})*\}/gu;
  const protectedParts = value => String(value).split(new RegExp(`(${protectedMath.source})`, "gu"));
  let currentLanguage = "uk";
  let messages = new Map();
  let fragments = null;
  let originalMessages = new Map();
  let originalFragments = null;
  let observer;
  let pending = [];
  let scheduled = false;

  function phrasePattern(keys) {
    // A compressed trie avoids engine limits and compilation pauses from an
    // alternation containing thousands of long manuscript paragraphs.
    const trie = { edges: new Map() };
    for (const key of keys) {
      let node = trie, remaining = key;
      while (remaining) {
        const edge = node.edges.get(remaining[0]);
        if (!edge) {
          const child = { edges: new Map() };
          node.edges.set(remaining[0], { label: remaining, node: child });
          node = child;
          break;
        }
        let common = 0;
        while (common < remaining.length && common < edge.label.length && remaining[common] === edge.label[common]) common++;
        if (common === edge.label.length) {
          node = edge.node;
          remaining = remaining.slice(common);
        } else {
          const branch = { edges: new Map() };
          branch.edges.set(edge.label[common], { label: edge.label.slice(common), node: edge.node });
          node.edges.set(remaining[0], { label: edge.label.slice(0, common), node: branch });
          node = branch;
          remaining = remaining.slice(common);
        }
      }
      node.terminal = { key, before: /^[\p{L}\p{N}_]/u.test(key), after: /[\p{L}\p{N}_]$/u.test(key) };
    }
    return trie;
  }

  function edgeEnd(source, offset, label) {
    if (source.startsWith(label, offset)) {
      offset += label.length;
      if (label.endsWith(" ")) while (/\s/.test(source[offset] || "")) offset++;
      return offset;
    }
    for (let index = 0; index < label.length; index++) {
      if (label[index] === " ") {
        if (!/\s/.test(source[offset] || "")) return -1;
        while (/\s/.test(source[offset] || "")) offset++;
      } else if (label[index] === source[offset]) offset++;
      else return -1;
    }
    return offset;
  }

  function replaceFragments(source, dictionary, trie) {
    let result = "", end = 0, offset = 0;
    while (offset < source.length) {
      let node = trie, cursor = offset, longest;
      while (cursor < source.length) {
        const initial = /\s/.test(source[cursor]) ? " " : source[cursor];
        const edge = node.edges.get(initial);
        if (!edge) break;
        cursor = edgeEnd(source, cursor, edge.label);
        if (cursor < 0) break;
        node = edge.node;
        const terminal = node.terminal;
        if (terminal && !(terminal.before && /[\p{L}\p{N}_]/u.test(source[offset - 1] || ""))
          && !(terminal.after && /[\p{L}\p{N}_]/u.test(source[cursor] || ""))) longest = { key: terminal.key, end: cursor };
      }
      if (longest) {
        result += source.slice(end, offset) + dictionary.get(longest.key);
        offset = longest.end;
        end = offset;
      } else offset += String.fromCodePoint(source.codePointAt(offset)).length;
    }
    return result + source.slice(end);
  }

  function setMessages(catalog) {
    messages = new Map(Object.entries(catalog?.messages || catalog || {})
      .filter(([source, target]) => typeof target === "string" && normalize(source))
      .map(([source, target]) => [normalize(source), target]));
    for (const [source, target] of [...messages]) {
      const from = protectedParts(source), to = protectedParts(target);
      if (from.length < 3 || from.length !== to.length) continue;
      if (from.some((part, index) => index % 2 && normalize(part) !== normalize(to[index]))) continue;
      for (let index = 0; index < from.length; index += 2) {
        const key = normalize(from[index]), value = normalize(to[index]);
        if (ukrainian.test(key) && /[A-Za-z]{2}/.test(value)
          && !/[А-Яа-яІіЇїЄєҐґ]{2}/.test(value) && !messages.has(key)) messages.set(key, value);
      }
    }
    fragments = phrasePattern([...messages.keys()].filter(key => ukrainian.test(key)));
    originalMessages = new Map();
    for (const [source, target] of messages) {
      const key = normalize(target);
      if (/[A-Za-z]/.test(key) && key !== source && !originalMessages.has(key)) originalMessages.set(key, source);
    }
    originalFragments = phrasePattern([...originalMessages.keys()]);
  }

  function replaceKnown(source, dictionary, pattern) {
    const normalized = normalize(source);
    const target = dictionary.get(normalized);
    const sourceMath = source.match(protectedMath) || [];
    const targetMath = target?.match(protectedMath) || [];
    if (target !== undefined && JSON.stringify(sourceMath.map(normalize)) === JSON.stringify(targetMath.map(normalize))) {
      let index = 0;
      const translated = target.replace(protectedMath, () => sourceMath[index++]);
      return source.match(/^\s*/)[0] + translated + source.match(/\s*$/)[0];
    }
    if (!pattern) return source;
    return protectedParts(source).map((part, index) => index % 2 ? part : replaceFragments(part, dictionary, pattern)).join("");
  }

  function t(value, language = currentLanguage) {
    const source = String(value ?? "");
    if (supported(language) !== "en" || !ukrainian.test(source)) return source;
    return translateNumericUnits(replaceKnown(source, messages, fragments));
  }

  const units = { "Н": "N", "кН": "kN", "кВт": "kW", "МВт": "MW", "Вт": "W", "кг": "kg", "мг": "mg", "г": "g", "т": "t", "л": "L", "мм": "mm", "см": "cm", "дм": "dm", "км": "km", "м": "m", "с": "s", "хв": "min", "год": "h", "В": "V", "А": "A", "Ом": "Ω", "МПа": "MPa", "ГПа": "GPa", "кПа": "kPa", "Па": "Pa", "МДж": "MJ", "кДж": "kJ", "Дж": "J", "рад": "rad", "град": "deg", "об": "rev", "Гц": "Hz", "кГц": "kHz", "К": "K" };
  const unitNames = Object.keys(units).sort((a, b) => b.length - a.length).join("|");
  const unitPattern = new RegExp(`(?<![\\p{L}_])(${unitNames})(?![\\p{L}_])`, "gu");
  const unitToken = `(?:${unitNames})(?![\\p{L}_])(?:[²³⁻¹]+|\\^[+−-]?\\d+)?`;
  const numericUnits = new RegExp(`(\\d[ \\t\\u00a0\\u202f]+)(${unitToken}(?:[ \\t]*[·⋅×/*][ \\t]*(?:\\d+[ \\t]+)?${unitToken})*)(?![\\p{L}_])`, "gu");

  function translateNumericUnits(source) {
    // A bare В can be a case label. Only a unit following a number receives
    // the SI spelling here; explicit equation units are handled by texText.
    return protectedParts(source).map((part, index) => index % 2 ? part
      : part.replace(numericUnits, (_, prefix, body) => prefix + body.replace(unitPattern, unit => units[unit]))).join("");
  }

  function inScript(source, offset) {
    const stack = [];
    for (let index = 0; index < offset; index++) {
      if (source[index] === "\\" && /[{}]/.test(source[index + 1] || "")) { index++; continue; }
      if (source[index] === "{") stack.push(Boolean(stack.at(-1)) || /[_^]\s*$/.test(source.slice(0, index)));
      else if (source[index] === "}") stack.pop();
    }
    return Boolean(stack.at(-1)) || /[_^]\s*$/.test(source.slice(0, offset));
  }

  // Translate equation prose and explicit units before typesetting; scientific
  // indices and numerical tokens retain their original spelling.
  function texText(value, language = currentLanguage) {
    const source = String(value ?? "");
    if (supported(language) !== "en") return source;
    const command = /\\(text|mathrm)\s*\{/g;
    let result = "", end = 0, match;
    while ((match = command.exec(source))) {
      const start = command.lastIndex;
      let depth = 1, cursor = start;
      while (cursor < source.length && depth) {
        if (source[cursor] === "\\" && /[{}]/.test(source[cursor + 1] || "")) { cursor += 2; continue; }
        if (source[cursor] === "{") depth++;
        else if (source[cursor] === "}") depth--;
        cursor++;
      }
      if (depth) break;
      const body = source.slice(start, cursor - 1);
      const translated = inScript(source, match.index) ? body.replace(/^(хв|с)(?=\^|$)/u, unit => units[unit])
        : match[1] === "text" ? t(body, language) : body.replace(unitPattern, unit => units[unit]);
      result += source.slice(end, start) + translated + "}";
      end = cursor;
      command.lastIndex = cursor;
    }
    return result + source.slice(end);
  }

  function excluded(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(element?.closest(ignored));
  }

  function translateText(node, language) {
    if (excluded(node)) return;
    const option = node.parentElement?.closest("option");
    if (option && !option.hasAttribute("value")) option.setAttribute("value", option.value);
    let record = textSources.get(node);
    if (!record || node.nodeValue !== record.rendered) {
      const englishContext = documentLanguages.get(node.ownerDocument) === "en" && (language === "uk" || !ukrainian.test(node.nodeValue));
      record = { source: englishContext ? replaceKnown(node.nodeValue, originalMessages, originalFragments) : node.nodeValue };
    }
    record.rendered = t(record.source, language);
    if (node.nodeValue !== record.rendered) node.nodeValue = record.rendered;
    textSources.set(node, record);
  }

  function translateAttributes(element, language) {
    if (excluded(element)) return;
    const records = attributeSources.get(element) || new Map();
    for (const name of attributesFor(element)) {
      const value = element.getAttribute(name);
      if (value === null) { records.delete(name); continue; }
      let record = records.get(name);
      if (!record || value !== record.rendered) {
        const englishContext = documentLanguages.get(element.ownerDocument) === "en" && (language === "uk" || !ukrainian.test(value));
        record = { source: englishContext ? replaceKnown(value, originalMessages, originalFragments) : value };
      }
      record.rendered = t(record.source, language);
      if (value !== record.rendered) element.setAttribute(name, record.rendered);
      records.set(name, record);
    }
    attributeSources.set(element, records);
  }

  function translateDocument(node = root.document, language = currentLanguage) {
    if (!node) return node;
    language = supported(language);
    const document = node.ownerDocument || node;
    if (node.nodeType === 3) translateText(node, language);
    else {
      const walker = document.createTreeWalker(node, 4);
      let text;
      while ((text = walker.nextNode())) translateText(text, language);
      if (node.nodeType === 1) translateAttributes(node, language);
      for (const element of node.querySelectorAll?.(attributeSelector) || []) translateAttributes(element, language);
    }
    if (node.nodeType === 9) {
      node.documentElement.lang = language;
      node.documentElement.dataset.language = language;
      documentLanguages.set(node, language);
    }
    return node;
  }

  function untranslated(node = root.document) {
    if (!node) return [];
    const remaining = new Set();
    const add = value => { if (ukrainian.test(value || "")) remaining.add(normalize(value)); };
    const document = node.ownerDocument || node;
    if (node.nodeType === 3 && !excluded(node)) add(node.nodeValue);
    const walker = document.createTreeWalker(node, 4);
    let text;
    while ((text = walker.nextNode())) if (!excluded(text)) add(text.nodeValue);
    const elements = [...node.querySelectorAll?.(attributeSelector) || []];
    if (node.nodeType === 1) elements.unshift(node);
    for (const element of elements) if (!excluded(element)) for (const attribute of attributesFor(element)) add(element.getAttribute(attribute));
    return [...remaining].filter(Boolean).sort((a, b) => a.localeCompare(b, "uk"));
  }

  function observe(document) {
    // Ukrainian is the source language of every renderer. Observe only when
    // translating newly rendered output, rather than rewalking its native DOM.
    if (currentLanguage === "en") observer?.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...translatedAttributes, "content"] });
  }

  function setLanguage(language) {
    const next = supported(language);
    const changed = currentLanguage !== next;
    currentLanguage = next;
    try { root.localStorage?.setItem(storageKey, next); } catch { /* Storage may be unavailable in a local/offline document. */ }
    observer?.disconnect();
    if (next === "en" || documentLanguages.get(root.document) === "en") translateDocument(root.document, next);
    else if (root.document) {
      root.document.documentElement.lang = next;
      root.document.documentElement.dataset.language = next;
    }
    for (const button of root.document?.querySelectorAll("[data-language-choice]") || []) {
      button.setAttribute("aria-pressed", String(button.dataset.languageChoice === next));
    }
    if (root.document) observe(root.document);
    if (changed && root.document) {
      root.document.dispatchEvent(new root.CustomEvent("languagechange", { bubbles: true, detail: { language: next } }));
    }
    return next;
  }

  function wire() {
    const document = root.document;
    let stored;
    try { stored = root.localStorage?.getItem(storageKey); } catch { /* See setLanguage. */ }
    setLanguage(stored || document.documentElement.dataset.language || "uk");
    document.addEventListener("click", event => {
      const button = event.target.closest?.("[data-language-choice]");
      if (button) setLanguage(button.dataset.languageChoice);
    });
    if (!root.MutationObserver) return;
    observer = new root.MutationObserver(records => {
      pending.push(...records);
      if (scheduled) return;
      scheduled = true;
      root.queueMicrotask(() => {
        scheduled = false;
        pending.push(...observer.takeRecords());
        const records = pending;
        pending = [];
        observer.disconnect();
        const nodes = new Set();
        for (const record of records) {
          if (record.type === "childList") for (const node of record.addedNodes) nodes.add(node);
          else nodes.add(record.target);
        }
        for (const node of nodes) if (node.isConnected) translateDocument(node, currentLanguage);
        observe(document);
      });
    });
    observe(document);
  }

  setMessages(root.MechanicsEnglishMessages);
  const api = Object.freeze({ get language() { return currentLanguage; }, storageKey, t, texText, setMessages, setLanguage, translateDocument, untranslated });
  root.MechanicsI18n = api;
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", wire, { once: true });
    else wire();
  }
})(typeof window === "object" ? window : globalThis);
