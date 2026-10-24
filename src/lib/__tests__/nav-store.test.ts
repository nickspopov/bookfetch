import { putFeedPage, resolveFeedPage } from '../nav-store';

const KEYED = 'https://kavita.example.com/api/opds/9003cf99-9213-4206-a787-af2fe4cc5f1f/series/12';

describe('feed page tokens', () => {
  it('round-trips a feed URL through an opaque token', () => {
    const token = putFeedPage('c1', KEYED);
    expect(token).not.toContain('kavita');
    expect(token).not.toContain('9003cf99');
    expect(resolveFeedPage('c1', token)).toEqual({ kind: 'page', url: KEYED });
  });

  it('gives each push its own token', () => {
    expect(putFeedPage('c1', KEYED)).not.toBe(putFeedPage('c1', KEYED));
  });

  it('opens the catalog root without a token', () => {
    expect(resolveFeedPage('c1', undefined)).toEqual({ kind: 'root' });
    expect(resolveFeedPage('c1', '')).toEqual({ kind: 'root' });
  });

  it('reports a token it does not know as gone, as after a restored route', () => {
    expect(resolveFeedPage('c1', 'p-restored-1')).toEqual({ kind: 'gone' });
  });

  it('does not open another catalog’s page', () => {
    const token = putFeedPage('c1', KEYED);
    expect(resolveFeedPage('c2', token)).toEqual({ kind: 'gone' });
  });

  it('forgets the oldest pages once the store is full', () => {
    const first = putFeedPage('c1', 'https://books.example.com/opds/first');
    for (let i = 0; i < 200; i += 1) putFeedPage('c1', `https://books.example.com/opds/${i}`);
    expect(resolveFeedPage('c1', first)).toEqual({ kind: 'gone' });
  });
});
