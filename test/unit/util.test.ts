import { describe, expect, it } from "vitest";
import { decodeEntities, stripTags } from "../../src/lib/util";

describe("decodeEntities", () => {
  it.each(["Beyoncé ©", "Beyonc&eacute; &copy;", "Beyonc&#233; &#169;", "Beyonc&#xE9; &#xA9;"])(
    "decodes equivalent text: %s",
    (text) => {
      expect(decodeEntities(text)).toBe("Beyoncé ©");
    },
  );

  it("uses HTML replacement characters for invalid numeric references", () => {
    expect(decodeEntities("&#1114112; &#xD800; &#0;")).toBe("� � �");
  });

  it("preserves case-sensitive names and unknown references", () => {
    expect(decodeEntities("&Eacute; &eacute; &NotEqualTilde; &unknown;")).toBe("É é ≂̸ &unknown;");
  });

  it("decodes a legacy entity without its semicolon in text", () => {
    expect(decodeEntities("Tom &amp Jerry")).toBe("Tom & Jerry");
  });

  it("leaves a bare ampersand in a URL query alone", () => {
    expect(decodeEntities("https://x/a?x=1&copy=2&notes=3")).toBe("https://x/a?x=1&copy=2&notes=3");
  });
});

describe("stripTags", () => {
  it("decodes text after removing markup and normalizes whitespace", () => {
    expect(stripTags("<p>Caf&eacute;&nbsp; &amp; &#x1F30A;</p>")).toBe("Café & 🌊");
    expect(stripTags("&lt;img src=x onerror=alert(1)&gt;")).toBe("<img src=x onerror=alert(1)>");
  });
});
