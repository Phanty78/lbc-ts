import { AdType, Category, Department, type AdType as AdTypeValue, type Category as CategoryValue, type Department as DepartmentValue, type OwnerType as OwnerTypeValue, type Region as RegionValue, Sort, type Sort as SortValue } from "./enums.js";
import { InvalidValueError } from "./errors.js";
import { City } from "./geo.js";

type FilterValue = readonly string[] | readonly number[];
type Location = City | RegionValue | DepartmentValue;
type Filters = Record<string, unknown>;
export type SearchPayload = Record<string, unknown>;

/** Options de recherche ; les clés supplémentaires sont des filtres Leboncoin, par exemple `price: [100, 500]`. */
export interface SearchOptions {
  url?: string;
  text?: string;
  category?: CategoryValue;
  sort?: SortValue;
  locations?: Location | readonly Location[];
  limit?: number;
  limitAlu?: number;
  page?: number;
  adType?: AdTypeValue;
  ownerType?: OwnerTypeValue;
  shippable?: boolean;
  searchInTitleOnly?: boolean;
  [filter: string]: unknown;
}

const basePayload = (limit: number, limitAlu: number, page: number): SearchPayload => ({
  filters: {}, limit, limit_alu: limitAlu, offset: limit * (page - 1), disable_total: true, extend: true,
  listing_source: page === 1 ? "direct-search" : "pagination",
});

const filters = (payload: SearchPayload): Filters => payload.filters as Filters;
const locationFilters = (payload: SearchPayload): Filters => {
  const value = filters(payload).location;
  if (value && typeof value === "object") return value as Filters;
  const location: Filters = {};
  filters(payload).location = location;
  return location;
};

/** Construit le payload API depuis une URL de recherche Leboncoin. */
export function buildSearchPayloadFromUrl(url: string, limit = 35, limitAlu = 3, page = 1): SearchPayload {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new InvalidValueError("The URL must be a valid Leboncoin search URL."); }
  const payload = basePayload(limit, limitAlu, page);
  for (const [key, value] of parsed.searchParams) {
    const current = filters(payload);
    if (key === "text") { current.keywords = { text: value }; continue; }
    if (key === "category") { current.category = { id: value }; continue; }
    if (key === "order") { payload.sort_order = value; continue; }
    if (key === "sort") { payload.sort_by = value; continue; }
    if (key === "owner_type") { payload.owner_type = value; continue; }
    if (key === "page") continue;
    if (key === "shippable") {
      if (value === "1") locationFilters(payload).shippable = true;
      continue;
    }
    if (key === "locations") { addUrlLocations(payload, value); continue; }
    const [min, max, ...rest] = value.split("-");
    if (max !== undefined && rest.length === 0) {
      const range: Filters = {};
      if (min) range.min = toInteger(min);
      if (max) range.max = toInteger(max);
      if (Object.keys(range).length) {
        const ranges = (current.ranges ??= {}) as Filters;
        ranges[key] = range;
      }
      continue;
    }
    const enums = (current.enums ??= {}) as Filters;
    enums[key] = value.split(",");
  }
  return payload;
}

/** Construit le payload API depuis les options TypeScript. */
export function buildSearchPayload(options: SearchOptions = {}): SearchPayload {
  const { text, category = Category.TOUTES_CATEGORIES, sort = Sort.RELEVANCE, locations, limit = 35, limitAlu = 3, page = 1, adType = AdType.OFFER, ownerType, shippable, searchInTitleOnly, url: _url, ...advanced } = options;
  const payload = basePayload(limit, limitAlu, page);
  const current = filters(payload);
  current.category = { id: category };
  current.enums = { ad_type: [adType] };
  current.keywords = { text: text ?? null };
  current.location = {};
  if (ownerType) payload.owner_type = ownerType;
  const [sortBy, sortOrder] = sort;
  payload.sort_by = sortBy;
  if (sortOrder) payload.sort_order = sortOrder;
  if (text && searchInTitleOnly) (current.keywords as Filters).type = "subject";
  if (locations) addLocations(payload, Array.isArray(locations) ? locations : [locations]);
  if (shippable) locationFilters(payload).shippable = true;
  for (const [key, value] of Object.entries(advanced)) addAdvancedFilter(payload, key, value);
  return payload;
}

function addLocations(payload: SearchPayload, locations: readonly Location[]): void {
  const items: Filters[] = [];
  for (const location of locations) {
    if (location instanceof City) {
      items.push({ locationType: "city", area: { lat: location.lat, lng: location.lng, radius: location.radius }, city: location.city, label: location.city ? `${location.city} (toute la ville)` : undefined });
      continue;
    }
    if (Array.isArray(location) && location.length === 2) { items.push({ locationType: "region", region_id: location[0] }); continue; }
    if (Array.isArray(location) && location.length === 4) { items.push({ locationType: "department", region_id: location[0], department_id: location[2] }); continue; }
    throw new InvalidValueError("Locations must be City, Region, or Department values.");
  }
  locationFilters(payload).locations = items;
}

function addUrlLocations(payload: SearchPayload, value: string): void {
  const items: Filters[] = [];
  for (const location of value.split(",")) {
    const [label, area] = location.split("__", 2);
    if (!label) continue;
    const [prefix, id] = label.split("_", 2);
    if (prefix === "d" && id) { items.push({ locationType: "department", department_id: id }); continue; }
    if (prefix === "r" && id) { items.push({ locationType: "region", region_id: id }); continue; }
    if (prefix === "p" && id && area) { items.push({ locationType: "place", place: id, label: id, area: buildArea(area) }); continue; }
    if (!area) throw new InvalidValueError(`Unknown location type: ${prefix ?? label}`);
    items.push({ locationType: "city", area: buildArea(area) });
  }
  locationFilters(payload).locations = items;
}

function buildArea(value: string): Filters {
  const [lat, lng, defaultRadius, radius] = value.split("_");
  if (!lat || !lng) throw new InvalidValueError("Invalid location area.");
  const area: Filters = { lat: toNumber(lat), lng: toNumber(lng) };
  if (defaultRadius) area.default_radius = toInteger(defaultRadius);
  if (radius) area.radius = toInteger(radius);
  return area;
}

function addAdvancedFilter(payload: SearchPayload, key: string, value: unknown): void {
  if (!Array.isArray(value)) throw new InvalidValueError(`The value of '${key}' must be a list.`);
  const current = filters(payload);
  if (value.every((item): item is number => typeof item === "number" && Number.isInteger(item))) {
    if (value.length < 2) throw new InvalidValueError(`The value of '${key}' must contain at least two numbers.`);
    const ranges = (current.ranges ??= {}) as Filters;
    ranges[key] = { min: value[0], max: value[1] };
    return;
  }
  if (value.every((item): item is string => typeof item === "string")) {
    ((current.enums ??= {}) as Filters)[key] = value;
    return;
  }
  throw new InvalidValueError(`The value of '${key}' must contain only numbers or only strings.`);
}

function toInteger(value: string): number { const parsed = Number.parseInt(value, 10); if (!Number.isFinite(parsed)) throw new InvalidValueError(`Invalid number: ${value}`); return parsed; }
function toNumber(value: string): number { const parsed = Number(value); if (!Number.isFinite(parsed)) throw new InvalidValueError(`Invalid number: ${value}`); return parsed; }
