import { describe, expect, test } from "bun:test";
import {
  AdType,
  buildSearchPayload,
  buildSearchPayloadFromUrl,
  Category,
  City,
  Department,
  InvalidValueError,
  OwnerType,
  Region,
  Sort,
} from "../src/index.js";

describe("search payloads", () => {
  test("builds the source API payload from typed options", () => {
    expect(
      buildSearchPayload({
        text: "maison",
        category: Category.IMMOBILIER,
        sort: Sort.NEWEST,
        locations: [new City(48.86, 2.34, 10_000, "Paris"), Department.PARIS, Region.ILE_DE_FRANCE],
        limit: 35,
        page: 2,
        adType: AdType.OFFER,
        ownerType: OwnerType.ALL,
        searchInTitleOnly: true,
        shippable: true,
        square: [200, 400],
        real_estate_type: ["3", "4"],
      }),
    ).toEqual({
      filters: {
        category: { id: "8" },
        enums: { ad_type: ["offer"], real_estate_type: ["3", "4"] },
        keywords: { text: "maison", type: "subject" },
        location: {
          locations: [
            {
              locationType: "city",
              area: { lat: 48.86, lng: 2.34, radius: 10_000 },
              city: "Paris",
              label: "Paris (toute la ville)",
            },
            { locationType: "department", region_id: "12", department_id: "75" },
            { locationType: "region", region_id: "12" },
          ],
          shippable: true,
        },
        ranges: { square: { min: 200, max: 400 } },
      },
      limit: 35,
      limit_alu: 3,
      offset: 35,
      disable_total: true,
      extend: true,
      listing_source: "pagination",
      owner_type: "all",
      sort_by: "time",
      sort_order: "desc",
    });
  });

  test("builds a search payload from a Leboncoin URL", () => {
    expect(
      buildSearchPayloadFromUrl(
        "https://www.leboncoin.fr/recherche?category=9&text=maison&locations=Paris__48.86_2.34_9256,d_75,r_12&price=500-1000&rooms=1-6&orientation=south_west&owner_type=private",
        10,
        0,
        2,
      ),
    ).toEqual({
      filters: {
        category: { id: "9" },
        keywords: { text: "maison" },
        location: {
          locations: [
            { locationType: "city", area: { lat: 48.86, lng: 2.34, default_radius: 9256 } },
            { locationType: "department", department_id: "75" },
            { locationType: "region", region_id: "12" },
          ],
        },
        ranges: { price: { min: 500, max: 1000 }, rooms: { min: 1, max: 6 } },
        enums: { orientation: ["south_west"] },
      },
      limit: 10,
      limit_alu: 0,
      offset: 10,
      disable_total: true,
      extend: true,
      listing_source: "pagination",
      owner_type: "private",
    });
  });

  test("fails fast on malformed advanced filters", () => {
    expect(() => buildSearchPayload({ price: [100] })).toThrow(InvalidValueError);
    expect(() => buildSearchPayload({ price: [100, "200"] })).toThrow(InvalidValueError);
    expect(buildSearchPayload({ real_estate_type: ["3"] }).filters).toEqual({
      category: { id: "0" },
      enums: { ad_type: ["offer"], real_estate_type: ["3"] },
      keywords: { text: null },
      location: {},
    });
  });
});
