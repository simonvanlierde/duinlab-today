import { expect, it } from "vitest";
import { parseWord } from "../../src/lib/sources/wiktionary";

function atom(sense: string) {
  const html = `<b><span id="WOTD-rss-title">Mamie pink</span></b> <i>n</i><div id="WOTD-rss-description"><ol><li>${sense}</li></ol></div>`;
  return `<feed><entry><id>/wotd/20261114</id><summary type="html">${html.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</summary></entry></feed>`;
}

it("omits Wiktionary's colour-swatch caption from the definition", () => {
  const definition = "(US, also attributive) A light rosy pink colour with a slight orangish tinge.";
  const swatch =
    '<dl><dd><div class="color-panel mw-no-invert">Mamie pink: <span style="background-color:#F3CAC5; display:inline-block; width:80px">&nbsp;</span></div></dd></dl>';
  expect(parseWord(atom(definition + swatch), "2026-11-14")?.gloss).toBe(definition);
});

it("keeps the word when it occurs in the definition itself", () => {
  const definition = "Mamie pink: a light rosy pink colour.";
  expect(parseWord(atom(definition), "2026-11-14")?.gloss).toBe(definition);
});
