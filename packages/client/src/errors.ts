// Normalized error type for the mdtidy API. The API returns
// `{ error: { code, message, requestId?, required?, balance? } }` (spec
// ApiError); we surface it as a typed throwable so tool handlers can branch on
// `code` (e.g. out_of_credits) without re-parsing.

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    required?: number;
    balance?: number;
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as { error?: unknown }).error;
  return (
    typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string'
  );
}

export class MdtidyApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  }) {
    super(`mdtidy ${args.status} ${args.code}: ${args.message}`);
    this.name = 'MdtidyApiError';
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    this.details = args.details;
  }
}
