export type Raw = Record<string, unknown>;
export type ClientLike = { getUser(userId: string): Promise<User> };

const record = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
const string = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
const number = (value: unknown): number | undefined => typeof value === "number" ? value : undefined;
const boolean = (value: unknown): boolean | undefined => typeof value === "boolean" ? value : undefined;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export interface Attribute {
  key?: string;
  keyLabel?: string;
  value?: string;
  valueLabel?: string;
  values: string[];
  valuesLabel: string[];
  valueLabelReader?: string;
  generic?: boolean;
}

export interface AdLocation {
  countryId?: string;
  regionId?: string;
  regionName?: string;
  departmentId?: string;
  departmentName?: string;
  cityLabel?: string;
  city?: string;
  zipcode?: string;
  lat?: number;
  lng?: number;
  source?: string;
  provider?: string;
  isShape?: boolean;
}

/** Représente une annonce Leboncoin. */
export class Ad {
  readonly id?: number;
  readonly firstPublicationDate?: string;
  readonly expirationDate?: string;
  readonly indexDate?: string;
  readonly status?: string;
  readonly categoryId?: string;
  readonly categoryName?: string;
  readonly subject?: string;
  readonly body?: string;
  readonly brand?: string;
  readonly adType?: string;
  readonly url?: string;
  readonly price?: number;
  readonly images: string[];
  readonly attributes: Record<string, Attribute>;
  readonly location: AdLocation;
  readonly hasPhone?: boolean;
  readonly favorites?: number;
  readonly #client: ClientLike;
  readonly #userId?: string;
  #user?: Promise<User>;

  constructor(raw: Raw, client: ClientLike) {
    const location = record(raw.location);
    const attributes: Record<string, Attribute> = {};
    for (const item of Array.isArray(raw.attributes) ? raw.attributes : []) {
      const attribute = record(item);
      const key = string(attribute.key);
      if (!key) continue;
      attributes[key] = {
        key,
        keyLabel: string(attribute.key_label),
        value: string(attribute.value),
        valueLabel: string(attribute.value_label),
        values: strings(attribute.values),
        valuesLabel: strings(attribute.values_label),
        valueLabelReader: string(attribute.value_label_reader),
        generic: boolean(attribute.generic),
      };
    }
    this.id = number(raw.list_id);
    this.firstPublicationDate = string(raw.first_publication_date);
    this.expirationDate = string(raw.expiration_date);
    this.indexDate = string(raw.index_date);
    this.status = string(raw.status);
    this.categoryId = string(raw.category_id);
    this.categoryName = string(raw.category_name);
    this.subject = string(raw.subject);
    this.body = string(raw.body);
    this.brand = string(raw.brand);
    this.adType = string(raw.ad_type);
    this.url = string(raw.url);
    const cents = number(raw.price_cents);
    this.price = cents === undefined ? undefined : cents / 100;
    this.images = strings(record(raw.images).urls_large);
    this.attributes = attributes;
    this.location = {
      countryId: string(location.country_id), regionId: string(location.region_id), regionName: string(location.region_name),
      departmentId: string(location.department_id), departmentName: string(location.department_name), cityLabel: string(location.city_label),
      city: string(location.city), zipcode: string(location.zipcode), lat: number(location.lat), lng: number(location.lng),
      source: string(location.source), provider: string(location.provider), isShape: boolean(location.is_shape),
    };
    this.hasPhone = boolean(raw.has_phone);
    this.favorites = number(record(raw.counters).favorites);
    this.#client = client;
    this.#userId = string(record(raw.owner).user_id);
  }

  get title(): string | undefined { return this.subject; }

  /** Charge le vendeur à la première lecture. */
  get user(): Promise<User> {
    if (!this.#user) {
      if (!this.#userId) return Promise.reject(new Error("The ad has no user ID."));
      this.#user = this.#client.getUser(this.#userId);
    }
    return this.#user;
  }
}

export class Search {
  readonly total?: number;
  readonly totalAll?: number;
  readonly totalPro?: number;
  readonly totalPrivate?: number;
  readonly totalActive?: number;
  readonly totalInactive?: number;
  readonly totalShippable?: number;
  readonly maxPages?: number;
  readonly ads: Ad[];

  constructor(raw: Raw, client: ClientLike) {
    this.total = number(raw.total);
    this.totalAll = number(raw.total_all);
    this.totalPro = number(raw.total_pro);
    this.totalPrivate = number(raw.total_private);
    this.totalActive = number(raw.total_active);
    this.totalInactive = number(raw.total_inactive);
    this.totalShippable = number(raw.total_shippable);
    this.maxPages = number(raw.max_pages);
    this.ads = (Array.isArray(raw.ads) ? raw.ads : []).map((ad) => new Ad(record(ad), client));
  }
}

export interface Feedback {
  overallScore?: number; cleanness?: number; communication?: number; conformity?: number; package?: number;
  product?: number; recommendation?: number; respect?: number; transaction?: number; userAttention?: number; receivedCount?: number;
  score?: number;
}
export interface Reply { inMinutes?: number; text?: string; rateText?: string; rate?: number; replyTimeText?: string; }
export interface Presence { status?: string; presenceText?: string; lastActivity?: string; enabled?: boolean; }
export interface Badge { type?: string; name?: string; }
export interface ProLocation { address?: string; district?: string; city?: string; label?: string; lat?: number; lng?: number; zipcode?: string; geoSource?: string; geoProvider?: string; region?: string; regionLabel?: string; department?: string; departmentLabel?: string; country?: string; }
export interface Review { authorName?: string; ratingValue?: number; text?: string; reviewTime?: string; }
export interface Rating { ratingValue?: number; userRatingsTotal?: number; source?: string; sourceDisplay?: string; retrievalTime?: string; url?: string; reviews: Review[]; }
export interface Pro { onlineStoreId?: number; onlineStoreName?: string; activitySectorId?: number; activitySector?: string; categoryId?: number; siren?: string; siret?: string; storeId?: number; activeSince?: string; location: ProLocation; logo?: string; cover?: string; slogan?: string; description?: string; openingHours?: string; websiteUrl?: string; rating: Rating; }

/** Représente le vendeur d’une annonce. */
export class User {
  readonly id?: string;
  readonly name?: string;
  readonly registeredAt?: string;
  readonly location?: string;
  readonly feedback: Feedback;
  readonly profilePicture?: string;
  readonly reply: Reply;
  readonly presence: Presence;
  readonly badges: Badge[];
  readonly totalAds?: number;
  readonly storeId?: number;
  readonly accountType?: string;
  readonly description?: string;
  readonly pro?: Pro;

  constructor(userData: Raw, proData?: Raw) {
    const feedback = record(userData.feedback);
    const scores = record(feedback.category_scores);
    const reply = record(userData.reply);
    const presence = record(userData.presence);
    this.id = string(userData.user_id);
    this.name = string(userData.name);
    this.registeredAt = string(userData.registered_at);
    this.location = string(userData.location);
    this.feedback = {
      overallScore: number(feedback.overall_score), cleanness: number(scores.CLEANNESS), communication: number(scores.COMMUNICATION), conformity: number(scores.CONFORMITY), package: number(scores.PACKAGE), product: number(scores.PRODUCT), recommendation: number(scores.RECOMMENDATION), respect: number(scores.RESPECT), transaction: number(scores.TRANSACTION), userAttention: number(scores.USER_ATTENTION), receivedCount: number(feedback.received_count),
      score: number(feedback.overall_score) === undefined ? undefined : number(feedback.overall_score)! * 5,
    };
    this.profilePicture = string(record(userData.profile_picture).extra_large_url);
    this.reply = { inMinutes: number(reply.in_minutes), text: string(reply.text), rateText: string(reply.rate_text), rate: number(reply.rate), replyTimeText: string(reply.reply_time_text) };
    this.presence = { status: string(presence.status), presenceText: string(presence.presence_text), lastActivity: string(presence.last_activity), enabled: boolean(presence.enabled) };
    this.badges = (Array.isArray(userData.badges) ? userData.badges : []).map((badge) => ({ type: string(record(badge).type), name: string(record(badge).name) }));
    this.totalAds = number(userData.total_ads);
    this.storeId = number(userData.store_id);
    this.accountType = string(userData.account_type);
    this.description = string(userData.description);
    this.pro = proData ? buildPro(proData) : undefined;
  }

  get isPro(): boolean { return this.accountType === "pro"; }
}

function buildPro(raw: Raw): Pro {
  const location = record(raw.location);
  const owner = record(raw.owner);
  const brand = record(raw.brand);
  const information = record(raw.information);
  const rating = record(raw.rating);
  return {
    onlineStoreId: number(raw.online_store_id), onlineStoreName: string(raw.online_store_name), activitySectorId: number(owner.activitySectorID), activitySector: string(owner.activitySector), categoryId: number(owner.categoryId), siren: string(owner.siren), siret: string(owner.siret), storeId: number(owner.storeId), activeSince: string(owner.activeSince),
    location: { address: string(location.address), district: string(location.district), city: string(location.city), label: string(location.label), lat: number(location.lat), lng: number(location.lng), zipcode: string(location.zipcode), geoSource: string(location.geo_source), geoProvider: string(location.geo_provider), region: string(location.region), regionLabel: string(location.region_label), department: string(location.department), departmentLabel: string(location.dpt_label), country: string(location.country) },
    logo: string(record(brand.logo).large), cover: string(record(brand.cover).large), slogan: string(brand.slogan), description: string(information.description), openingHours: string(information.opening_hours), websiteUrl: string(information.website_url),
    rating: { ratingValue: number(rating.rating_value), userRatingsTotal: number(rating.user_ratings_total), source: string(rating.source), sourceDisplay: string(rating.source_display), retrievalTime: string(rating.retrieval_time), url: string(rating.url), reviews: (Array.isArray(rating.reviews) ? rating.reviews : []).map((review) => ({ authorName: string(record(review).author_name), ratingValue: number(record(review).rating_value), text: string(record(review).text), reviewTime: string(record(review).review_time) })) },
  };
}
