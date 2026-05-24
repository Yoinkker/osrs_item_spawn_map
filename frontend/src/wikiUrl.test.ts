import { describe, expect, it } from "vitest";

import { wikiItemUrl } from "./wikiUrl.ts";

describe("wikiItemUrl", () => {
  it("uses underscores for spaces", () => {
    expect(wikiItemUrl("Air rune")).toBe("https://oldschool.runescape.wiki/w/Air_rune");
  });

  it("preserves apostrophes and parentheses", () => {
    expect(wikiItemUrl("Ahab's beer")).toBe("https://oldschool.runescape.wiki/w/Ahab's_beer");
  });

  it("builds item page URLs without spawn quantity labels", () => {
    expect(wikiItemUrl("Chaos rune")).toBe("https://oldschool.runescape.wiki/w/Chaos_rune");
  });

  it("percent-encodes characters that would break the URL", () => {
    expect(wikiItemUrl("A&B")).toBe("https://oldschool.runescape.wiki/w/A%26B");
    expect(wikiItemUrl("Question?mark")).toBe("https://oldschool.runescape.wiki/w/Question%3Fmark");
    expect(wikiItemUrl("Hash#tag")).toBe("https://oldschool.runescape.wiki/w/Hash%23tag");
  });
});
