export type AppErrorCode =
  | "SEARCH_FAILED"
  | "CRAWL_FAILED"
  | "SOURCE_UNAVAILABLE"
  | "EXTRACTION_FAILED"
  | "SCHEMA_VALIDATION_FAILED"
  | "VERIFICATION_FAILED"
  | "DATABASE_ERROR"
  | "MISTRAL_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_URL";

export interface TypedErrorPayload {
  code: AppErrorCode;
  message: string;
  recoveryAction: string;
  details?: Record<string, unknown> | undefined;
}

export function getDefaultRecoveryAction(code: AppErrorCode): string {
  switch (code) {
    case "SEARCH_FAILED":
      return "Retry web search with broader query parameters or check API connectivity.";
    case "CRAWL_FAILED":
      return "Retry fetching inaccessible sources or review network firewall rules.";
    case "SOURCE_UNAVAILABLE":
      return "Source domain is unreachable or blocked. Attempt research with secondary sources.";
    case "EXTRACTION_FAILED":
      return "Could not extract structured records from search output. Refine required fields and rerun.";
    case "SCHEMA_VALIDATION_FAILED":
      return "Extracted output does not conform to the required schema. Re-validate requirement blueprint.";
    case "VERIFICATION_FAILED":
      return "Cross-source verification encountered contradictions. Review highlighted conflicts.";
    case "DATABASE_ERROR":
      return "Persistence operation failed. Verify database connectivity and disk permissions.";
    case "MISTRAL_ERROR":
      return "Mistral API returned an unexpected error. Check API credentials and model quota.";
    case "RATE_LIMITED":
      return "Mistral or search rate limit exceeded. Please wait 15 seconds before retrying.";
    case "TIMEOUT":
      return "Research pipeline exceeded operation timeout. Consider narrowing geographic scope or field count.";
    case "INVALID_URL":
      return "URL failed SSRF validation or syntax verification. Check source domain safety.";
    default:
      return "Review error details and retry the research workflow.";
  }
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly recoveryAction: string;
  readonly details?: Record<string, unknown> | undefined;

  constructor(
    code: AppErrorCode,
    message: string,
    recoveryAction?: string | undefined,
    details?: Record<string, unknown> | undefined,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.recoveryAction = recoveryAction ?? getDefaultRecoveryAction(code);
    this.details = details;
  }

  toJSON(): TypedErrorPayload {
    return {
      code: this.code,
      message: this.message,
      recoveryAction: this.recoveryAction,
      details: this.details,
    };
  }
}

export function toTypedError(err: unknown, fallbackCode: AppErrorCode = "MISTRAL_ERROR"): AppError {
  if (err instanceof AppError) {
    return err;
  }

  const msg = err instanceof Error ? err.message : String(err);
  const msgLower = msg.toLowerCase();

  if (msgLower.includes("rate limit") || msgLower.includes("429") || msgLower.includes("quota")) {
    return new AppError(
      "RATE_LIMITED",
      msg,
      "Mistral API rate limit encountered. Retrying in a few moments may resolve the issue.",
    );
  }
  if (
    msgLower.includes("timeout") ||
    msgLower.includes("timed out") ||
    msgLower.includes("abort")
  ) {
    return new AppError(
      "TIMEOUT",
      msg,
      "Pipeline stage timed out. Check internet connection and rerun.",
    );
  }
  if (
    msgLower.includes("ssrf") ||
    msgLower.includes("private ip") ||
    msgLower.includes("invalid url")
  ) {
    return new AppError("INVALID_URL", msg, "External URL was rejected by SSRF security policy.");
  }
  if (msgLower.includes("database") || msgLower.includes("sqlite") || msgLower.includes("disk")) {
    return new AppError(
      "DATABASE_ERROR",
      msg,
      "Database persistence failed. Check storage health.",
    );
  }
  if (msgLower.includes("schema") || msgLower.includes("zod")) {
    return new AppError(
      "SCHEMA_VALIDATION_FAILED",
      msg,
      "Output did not match the expected schema.",
    );
  }
  if (msgLower.includes("search") && (msgLower.includes("failed") || msgLower.includes("empty"))) {
    return new AppError("SEARCH_FAILED", msg, "Web search could not retrieve candidate listings.");
  }
  if (msgLower.includes("extract")) {
    return new AppError(
      "EXTRACTION_FAILED",
      msg,
      "Structured field extraction could not be completed.",
    );
  }

  return new AppError(fallbackCode, msg);
}
