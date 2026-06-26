import { describe, expect, it } from "vitest";

import { parseQuestLinks, wikiItemUrl } from "./wikiUrl.ts";

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

describe("parseQuestLinks", () => {
  it("returns no quests for null, empty, or link-free values", () => {
    expect(parseQuestLinks(null)).toEqual([]);
    expect(parseQuestLinks("")).toEqual([]);
    expect(parseQuestLinks("Yes")).toEqual([]);
    expect(parseQuestLinks("No")).toEqual([]);
  });

  it("parses a single quest link", () => {
    expect(parseQuestLinks("[[King's Ransom]]")).toEqual([
      { page: "King's Ransom", display: "King's Ransom" },
    ]);
  });

  it("uses the piped display text", () => {
    expect(parseQuestLinks("[[Sea Slug Quest|Sea Slug]]")).toEqual([
      { page: "Sea Slug Quest", display: "Sea Slug" },
    ]);
  });

  it("parses multiple quests", () => {
    expect(parseQuestLinks("[[Biohazard]], [[One Small Favour]]")).toEqual([
      { page: "Biohazard", display: "Biohazard" },
      { page: "One Small Favour", display: "One Small Favour" },
    ]);
  });

  it("ignores the Miniquest marker link", () => {
    expect(parseQuestLinks("[[Lair of Tarn Razorlor]] [[Miniquest]]")).toEqual([
      { page: "Lair of Tarn Razorlor", display: "Lair of Tarn Razorlor" },
    ]);
  });
});
