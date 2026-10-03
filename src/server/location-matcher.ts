/**
 * DATAINTEL — Normalized Geographic Location Matching Engine
 *
 * Implements Requirement 13:
 * - Normalized geographic matching (country, state, city, remoteStatus).
 * - Understands aliases (e.g. Bengaluru = Bangalore, Gurugram = Gurgaon, Mumbai = Bombay).
 * - Distinguishes between city, state, country, and remote hierarchies.
 * - Prevents false matches (Bengaluru != Chennai).
 * - India satisfies country-level requirement, but city requirement not satisfied by country alone.
 * - Returns: PASS, FAIL, UNKNOWN with explicit reasons.
 */

export interface NormalizedLocation {
  raw: string;
  country?: string | undefined;
  state?: string | undefined;
  city?: string | undefined;
  isRemote?: boolean | undefined;
  isHybrid?: boolean | undefined;
}

interface GeoEntity {
  canonicalCity?: string;
  state?: string;
  country: string;
  aliases: string[];
}

// Indian & International Geographic Knowledge Base
const GEO_ENTITIES: GeoEntity[] = [
  {
    canonicalCity: "Bengaluru",
    state: "Karnataka",
    country: "India",
    aliases: [
      "bengaluru",
      "bangalore",
      "blr",
      "bangaluru",
      "whitefield",
      "electronic city",
      "koramangala",
      "indiranagar",
    ],
  },
  {
    canonicalCity: "Mumbai",
    state: "Maharashtra",
    country: "India",
    aliases: ["mumbai", "bombay", "navi mumbai", "thane", "bkc", "andheri"],
  },
  {
    canonicalCity: "Pune",
    state: "Maharashtra",
    country: "India",
    aliases: ["pune", "poona", "hinjewadi", "magarpatta"],
  },
  {
    canonicalCity: "Hyderabad",
    state: "Telangana",
    country: "India",
    aliases: ["hyderabad", "secunderabad", "cyberabad", "hitech city", "gachibowli", "madhapur"],
  },
  {
    canonicalCity: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    aliases: ["chennai", "madras", "omr", "guindy", "t nagar", "velachery"],
  },
  {
    canonicalCity: "Delhi NCR",
    state: "Delhi",
    country: "India",
    aliases: ["delhi", "new delhi", "ncr", "national capital region"],
  },
  {
    canonicalCity: "Gurugram",
    state: "Haryana",
    country: "India",
    aliases: ["gurugram", "gurgaon", "cyber city", "sohna road"],
  },
  {
    canonicalCity: "Noida",
    state: "Uttar Pradesh",
    country: "India",
    aliases: ["noida", "greater noida", "sector 62", "sector 125"],
  },
  {
    canonicalCity: "Kolkata",
    state: "West Bengal",
    country: "India",
    aliases: ["kolkata", "calcutta", "salt lake", "new town"],
  },
  {
    canonicalCity: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    aliases: ["ahmedabad", "gandhinagar", "gift city"],
  },
  {
    canonicalCity: "Kochi",
    state: "Kerala",
    country: "India",
    aliases: ["kochi", "cochin", "infopark", "kakkanad"],
  },
  {
    canonicalCity: "Thiruvananthapuram",
    state: "Kerala",
    country: "India",
    aliases: ["thiruvananthapuram", "trivandrum", "technopark"],
  },
  {
    canonicalCity: "Chandigarh",
    state: "Chandigarh",
    country: "India",
    aliases: ["chandigarh", "mohali", "panchkula"],
  },
  {
    canonicalCity: "Jaipur",
    state: "Rajasthan",
    country: "India",
    aliases: ["jaipur"],
  },
  {
    canonicalCity: "Indore",
    state: "Madhya Pradesh",
    country: "India",
    aliases: ["indore"],
  },
  {
    canonicalCity: "Coimbatore",
    state: "Tamil Nadu",
    country: "India",
    aliases: ["coimbatore"],
  },
];

const INDIAN_STATES = [
  "andhra pradesh",
  "arunachal pradesh",
  "assam",
  "bihar",
  "chhattisgarh",
  "goa",
  "gujarat",
  "haryana",
  "himachal pradesh",
  "jharkhand",
  "karnataka",
  "kerala",
  "madhya pradesh",
  "maharashtra",
  "manipur",
  "meghalaya",
  "mizoram",
  "nagaland",
  "odisha",
  "punjab",
  "rajasthan",
  "sikkim",
  "tamil nadu",
  "telangana",
  "tripura",
  "uttar pradesh",
  "uttarakhand",
  "west bengal",
  "delhi",
  "chandigarh",
];

const FOREIGN_COUNTRIES = [
  "united states",
  "usa",
  "us",
  "uk",
  "united kingdom",
  "london",
  "singapore",
  "germany",
  "berlin",
  "canada",
  "toronto",
  "vancouver",
  "australia",
  "sydney",
  "melbourne",
  "dubai",
  "uae",
  "netherlands",
  "amsterdam",
  "ireland",
  "dublin",
];

/**
 * Parses raw location text into structured geographic components.
 */
export function normalizeLocation(raw: string): NormalizedLocation {
  if (!raw) return { raw: "" };

  const clean = raw.trim();
  const lower = clean.toLowerCase();

  const isRemote = /\b(remote|work from home|wfh|anywhere)\b/i.test(lower);
  const isHybrid = /\b(hybrid|flexible)\b/i.test(lower);

  let detectedCity: string | undefined;
  let detectedState: string | undefined;
  let detectedCountry: string | undefined;

  // 1. Check known cities
  for (const entity of GEO_ENTITIES) {
    for (const alias of entity.aliases) {
      const regex = new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(lower)) {
        detectedCity = entity.canonicalCity;
        detectedState = entity.state;
        detectedCountry = entity.country;
        break;
      }
    }
    if (detectedCity) break;
  }

  // 2. Check Indian states if not already resolved
  if (!detectedState) {
    for (const st of INDIAN_STATES) {
      const regex = new RegExp(`\\b${st.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (regex.test(lower)) {
        detectedState = st.charAt(0).toUpperCase() + st.slice(1);
        detectedCountry = "India";
        break;
      }
    }
  }

  // 3. Check Country
  if (!detectedCountry) {
    if (/\b(india|indian|in)\b/i.test(lower)) {
      detectedCountry = "India";
    } else {
      for (const fc of FOREIGN_COUNTRIES) {
        const regex = new RegExp(`\\b${fc}\\b`, "i");
        if (regex.test(lower)) {
          detectedCountry = fc.toUpperCase();
          break;
        }
      }
    }
  }

  return {
    raw: clean,
    city: detectedCity,
    state: detectedState,
    country: detectedCountry,
    isRemote,
    isHybrid,
  };
}

export type LocationMatchResult = "PASS" | "FAIL" | "UNKNOWN";

export interface LocationComparison {
  result: LocationMatchResult;
  reason: string;
  normalizedRequired: NormalizedLocation;
  normalizedActual: NormalizedLocation;
}

/**
 * Generalized geographic comparator.
 * Enforces:
 * - Bengaluru == Bangalore (PASS)
 * - Bengaluru != Chennai (FAIL)
 * - India (required) is satisfied by Bengaluru or India (PASS)
 * - Bengaluru (required) is NOT satisfied by just "India" (UNKNOWN)
 * - US or London when India required (FAIL)
 */
export function matchLocation(
  required: string,
  actual: string | null | undefined,
): LocationComparison {
  const normReq = normalizeLocation(required);

  if (
    !actual ||
    actual === "—" ||
    actual.toLowerCase() === "unknown" ||
    actual.toLowerCase() === "not disclosed"
  ) {
    return {
      result: "UNKNOWN",
      reason: "LOCATION_NOT_FOUND",
      normalizedRequired: normReq,
      normalizedActual: { raw: actual || "" },
    };
  }

  const normAct = normalizeLocation(actual);

  // 1. Remote matching
  if (normReq.isRemote) {
    if (normAct.isRemote) {
      return {
        result: "PASS",
        reason: "REMOTE_MATCH",
        normalizedRequired: normReq,
        normalizedActual: normAct,
      };
    }
    // If requirement wanted remote but actual is strictly on-site in a city
    if (!normAct.isRemote && !normAct.isHybrid) {
      return {
        result: "FAIL",
        reason: `ON_SITE_ONLY: required remote, actual is ${normAct.raw}`,
        normalizedRequired: normReq,
        normalizedActual: normAct,
      };
    }
  }

  // 2. City-level requirement
  if (normReq.city) {
    if (normAct.city) {
      if (normAct.city.toLowerCase() === normReq.city.toLowerCase()) {
        return {
          result: "PASS",
          reason: `CITY_MATCH: ${normAct.city} matches required ${normReq.city}`,
          normalizedRequired: normReq,
          normalizedActual: normAct,
        };
      } else {
        return {
          result: "FAIL",
          reason: `CITY_MISMATCH: actual ${normAct.city} does not match required ${normReq.city}`,
          normalizedRequired: normReq,
          normalizedActual: normAct,
        };
      }
    }

    // Actual specifies country/remote but no specific city
    if (normAct.isRemote && normAct.country === normReq.country) {
      return {
        result: "PASS",
        reason: `REMOTE_IN_TARGET_COUNTRY: Remote role within ${normReq.country}`,
        normalizedRequired: normReq,
        normalizedActual: normAct,
      };
    }

    if (normAct.country && !normAct.city) {
      return {
        result: "UNKNOWN",
        reason: `CITY_UNSPECIFIED: Required city ${normReq.city}, but actual only specifies country '${normAct.country}'`,
        normalizedRequired: normReq,
        normalizedActual: normAct,
      };
    }
  }

  // 3. State-level requirement
  if (normReq.state && !normReq.city) {
    if (normAct.state) {
      if (normAct.state.toLowerCase() === normReq.state.toLowerCase()) {
        return {
          result: "PASS",
          reason: `STATE_MATCH: ${normAct.state} matches ${normReq.state}`,
          normalizedRequired: normReq,
          normalizedActual: normAct,
        };
      } else {
        return {
          result: "FAIL",
          reason: `STATE_MISMATCH: actual ${normAct.state} does not match ${normReq.state}`,
          normalizedRequired: normReq,
          normalizedActual: normAct,
        };
      }
    }
  }

  // 4. Country-level requirement (e.g. "India" or "Indian")
  if (normReq.country) {
    if (normAct.country) {
      if (normAct.country.toLowerCase() === normReq.country.toLowerCase()) {
        return {
          result: "PASS",
          reason: `COUNTRY_MATCH: ${normAct.country} matches required ${normReq.country}`,
          normalizedRequired: normReq,
          normalizedActual: normAct,
        };
      } else {
        return {
          result: "FAIL",
          reason: `COUNTRY_MISMATCH: actual ${normAct.country} does not match required ${normReq.country}`,
          normalizedRequired: normReq,
          normalizedActual: normAct,
        };
      }
    }
  }

  // 5. Fallback substring match if non-standard geography
  const actClean = normAct.raw.toLowerCase();
  const reqClean = normReq.raw.toLowerCase();
  if (actClean.includes(reqClean)) {
    return {
      result: "PASS",
      reason: `TEXT_MATCH: '${normAct.raw}' contains '${normReq.raw}'`,
      normalizedRequired: normReq,
      normalizedActual: normAct,
    };
  }

  return {
    result: "UNKNOWN",
    reason: `GEOGRAPHY_INCONCLUSIVE: could not conclusively match '${normAct.raw}' with required '${normReq.raw}'`,
    normalizedRequired: normReq,
    normalizedActual: normAct,
  };
}
