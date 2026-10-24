import { OpdsError } from '@/opds';

export interface ErrorCopy {
  message: string;
  /** the server wants a login: offer the login fields or "Edit login" */
  needsLogin: boolean;
}

/** Turns anything thrown by the OPDS client into the sentence shown to the user. */
export function describeError(error: unknown, sentCredentials: boolean): ErrorCopy {
  const code = error instanceof OpdsError ? error.code : isOpdsLike(error) ? error.code : undefined;
  const status = error instanceof OpdsError || isOpdsLike(error) ? error.status : undefined;
  switch (code) {
    case 'invalid-url':
      return { message: "That doesn't look like a web address.", needsLogin: false };
    case 'network':
      return { message: "Couldn't reach the server. Check the address and your connection.", needsLogin: false };
    case 'timeout':
      return { message: 'The server took too long to answer.', needsLogin: false };
    case 'unauthorized':
      return {
        message: sentCredentials ? 'Wrong username or password.' : 'The server asked for a login.',
        needsLogin: true,
      };
    case 'not-found':
      return { message: 'Nothing at that address (404).', needsLogin: false };
    case 'http':
      return {
        message: status ? `The server answered with an error (${status}).` : 'The server answered with an error.',
        needsLogin: false,
      };
    case 'not-opds':
      return {
        message: "That address isn't an OPDS catalog. Look for an OPDS link in your server's settings.",
        needsLogin: false,
      };
    case 'opds2-unsupported':
      return { message: 'This is an OPDS 2 catalog. Bookfetch supports OPDS 1 for now.', needsLogin: false };
    case 'parse':
      return { message: "The catalog sent something Bookfetch couldn't read.", needsLogin: false };
    default:
      if (error instanceof Error && error.name === 'MissingSecretError') {
        return {
          message: "This catalog's address is missing on this phone. Edit the catalog and enter it again.",
          needsLogin: false,
        };
      }
      return { message: 'Something went wrong. Try again.', needsLogin: false };
  }
}

// Errors can cross module copies (e.g. a test double); accept anything shaped like an OpdsError.
function isOpdsLike(error: unknown): error is { code: OpdsError['code']; status?: number } {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'OpdsError' &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}
