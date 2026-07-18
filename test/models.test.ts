import { expect, test } from "bun:test";
import { Ad, Search, User } from "../src/index.js";

test("parses ads and loads their seller lazily", async () => {
  const seller = new User({ user_id: "seller", account_type: "pro", feedback: { overall_score: 0.8 } });
  let calls = 0;
  const client = { getUser: async () => { calls += 1; return seller; } };
  const ad = new Ad({ list_id: 42, subject: "Maison", price_cents: 123_400, images: { urls_large: ["https://image"] }, attributes: [{ key: "square", value: "100" }], location: { city: "Paris" }, owner: { user_id: "seller" } }, client);
  expect(ad.title).toBe("Maison");
  expect(ad.price).toBe(1234);
  expect(ad.attributes.square?.value).toBe("100");
  expect(await ad.user).toBe(seller);
  expect(await ad.user).toBe(seller);
  expect(calls).toBe(1);
});

test("parses search counters and ads", () => {
  const search = new Search({ total: 1, max_pages: 1, ads: [{ list_id: 42, images: {}, location: {}, owner: {} }] }, { getUser: async () => new User({}) });
  expect(search.total).toBe(1);
  expect(search.ads).toHaveLength(1);
});
