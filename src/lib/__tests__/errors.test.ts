import { OpdsError, type OpdsErrorCode } from '@/opds';

import { MissingSecretError } from '../client';
import { describeError } from '../errors';

jest.mock('expo-secure-store', () => ({}));

const error = (code: OpdsErrorCode, status?: number) => new OpdsError(code, 'core message', status);

describe('describeError', () => {
  it.each<[OpdsErrorCode, number | undefined, string]>([
    ['invalid-url', undefined, "That doesn't look like a web address."],
    ['network', undefined, "Couldn't reach the server. Check the address and your connection."],
    ['timeout', undefined, 'The server took too long to answer.'],
    ['not-found', 404, 'Nothing at that address (404).'],
    ['http', 502, 'The server answered with an error (502).'],
    ['not-opds', 200, "That address isn't an OPDS catalog. Look for an OPDS link in your server's settings."],
    ['opds2-unsupported', undefined, 'This is an OPDS 2 catalog. Bookfetch supports OPDS 1 for now.'],
    ['parse', undefined, "The catalog sent something Bookfetch couldn't read."],
  ])('maps %s', (code, status, message) => {
    expect(describeError(error(code, status), false)).toEqual({ message, needsLogin: false });
  });

  it('asks for a login when none was sent', () => {
    expect(describeError(error('unauthorized', 401), false)).toEqual({
      message: 'The server asked for a login.',
      needsLogin: true,
    });
  });

  it('reports wrong credentials when a login was sent', () => {
    expect(describeError(error('unauthorized', 403), true)).toEqual({
      message: 'Wrong username or password.',
      needsLogin: true,
    });
  });

  it('accepts OpdsError-shaped objects from another module copy', () => {
    const foreign = Object.assign(new Error('x'), { name: 'OpdsError', code: 'timeout' });
    expect(describeError(foreign, false).message).toBe('The server took too long to answer.');
  });

  it('explains a missing keychain URL', () => {
    expect(describeError(new MissingSecretError(), false).message).toMatch(/Edit the catalog/);
  });

  it('falls back to a generic sentence', () => {
    expect(describeError(new TypeError('boom'), false)).toEqual({
      message: 'Something went wrong. Try again.',
      needsLogin: false,
    });
    expect(describeError(undefined, false).needsLogin).toBe(false);
  });
});
