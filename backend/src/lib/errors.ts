export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const ErrorCodes = {
  SERVER_NOT_FOUND: "SERVER_NOT_FOUND",
  COLLECTION_FAILED: "COLLECTION_FAILED",
  RELEASE_LOOKUP_FAILED: "RELEASE_LOOKUP_FAILED",
  SOFTWARE_NOT_FOUND: "SOFTWARE_NOT_FOUND",
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
  ANALYSIS_NOT_FOUND: "ANALYSIS_NOT_FOUND",
  REPORT_FAILED: "REPORT_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;
