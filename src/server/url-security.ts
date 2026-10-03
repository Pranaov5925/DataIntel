/**
 * ═════════════════════════════════════════════════════════════════════════════
 * DataIntel — URL Security & SSRF Protection Engine
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Enforces strict URL validation, SSRF defense, private IP blocking,
 * cloud metadata endpoint blocking, and safe external navigation.
 */

export interface UrlValidationResult {
  valid: boolean;
  canonicalUrl: string;
  domain: string;
  isPrivateOrLoopback: boolean;
  error?: string;
}

// Blocked private IPv4 ranges & cloud metadata
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback (127.0.0.0/8)
  /^10\./, // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B (172.16.0.0/12)
  /^192\.168\./, // Private Class C (192.168.0.0/16)
  /^169\.254\./, // Link-local & Cloud Metadata (169.254.0.0/16)
  /^0\./, // Zero addresses (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
  "instance-data",
]);

/**
 * Validates an external URL for safe crawling, storage, and rendering.
 */
export function validateExternalUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      valid: false,
      canonicalUrl: "",
      domain: "",
      isPrivateOrLoopback: false,
      error: "URL is empty or not a string",
    };
  }

  let trimmed = rawUrl.trim();
  // Ensure http or https scheme
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    trimmed = "https://" + trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    // 1. Only allow HTTP and HTTPS
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        canonicalUrl: trimmed,
        domain: "",
        isPrivateOrLoopback: false,
        error: `Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    // 2. Reject empty or invalid hostname
    if (!hostname || hostname.includes(" ")) {
      return {
        valid: false,
        canonicalUrl: trimmed,
        domain: "",
        isPrivateOrLoopback: false,
        error: "Invalid hostname",
      };
    }

    // 3. Block known loopback and metadata hostnames
    if (
      BLOCKED_HOSTNAMES.has(hostname) ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return {
        valid: false,
        canonicalUrl: trimmed,
        domain: hostname,
        isPrivateOrLoopback: true,
        error: `Blocked hostname (loopback/internal): ${hostname}`,
      };
    }

    // 4. Block private and link-local IP addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return {
          valid: false,
          canonicalUrl: trimmed,
          domain: hostname,
          isPrivateOrLoopback: true,
          error: `Blocked private or cloud metadata IP address: ${hostname}`,
        };
      }
    }

    const domain = hostname.replace(/^www\./, "");

    return {
      valid: true,
      canonicalUrl: parsed.toString(),
      domain,
      isPrivateOrLoopback: false,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      canonicalUrl: rawUrl,
      domain: "",
      isPrivateOrLoopback: false,
      error: err instanceof Error ? err.message : "Malformed URL syntax",
    };
  }
}

/**
 * Sanitizes external URL for frontend <a> tags:
 * Ensures valid format, http/https, and returns safe props.
 */
export function getSafeExternalLinkProps(urlStr?: string | null): {
  href: string;
  target: "_blank";
  rel: "noopener noreferrer";
  isValid: boolean;
} {
  if (!urlStr || urlStr === "—" || urlStr === "Web Source") {
    return {
      href: "#",
      target: "_blank",
      rel: "noopener noreferrer",
      isValid: false,
    };
  }

  const validation = validateExternalUrl(urlStr);
  if (!validation.valid || validation.isPrivateOrLoopback) {
    return {
      href: "#",
      target: "_blank",
      rel: "noopener noreferrer",
      isValid: false,
    };
  }

  return {
    href: validation.canonicalUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    isValid: true,
  };
}
