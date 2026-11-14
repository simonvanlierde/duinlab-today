import { describe, expect, it } from "vitest";
import { decodeEntities, stripTags } from "../../src/lib/util";

describe("decodeEntities", () => {
	it.each([
		"Beyoncé ©",
		"Beyonc&eacute; &copy;",
		"Beyonc&#233; &#169;",
		"Beyonc&#xE9; &#xA9;",
	])("decodes equivalent text: %s", (text) => {
		expect(decodeEntities(text)).toBe("Beyoncé ©");
	});

	it("uses HTML replacement characters for invalid numeric references", () => {
		expect(decodeEntities("&#1114112; &#xD800; &#0;")).toBe("� � �");
	});

	it("preserves case-sensitive names and unknown references", () => {
		expect(decodeEntities("&Eacute; &eacute; &NotEqualTilde; &unknown;")).toBe(
			"É é ≂̸ &unknown;",
		);
	});
});

describe("stripTags", () => {
	it("decodes text after removing markup and normalizes whitespace", () => {
		expect(stripTags("<p>Caf&eacute;&nbsp; &amp; &#x1F30A;</p>")).toBe(
			"Café & 🌊",
		);
		expect(stripTags("&lt;img src=x onerror=alert(1)&gt;")).toBe(
			"<img src=x onerror=alert(1)>",
		);
	});
});
