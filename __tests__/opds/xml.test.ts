/// <reference types="jest" />
import { parseXml } from '../../src/opds/xml';

describe('parseXml', () => {
  it('collects many repeated children in linear time and keeps their order', () => {
    // 100,000 empty entries: about 0.2 s when children are appended, about 15 s with the old copy-per-child code
    const count = 100000;
    const items = Array.from({ length: count }, (_, i) => `<entry n="${i}"/>`).join('');
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Big</title>${items}</feed>`;
    const started = Date.now();
    const [rootName, root] = parseXml(xml);
    const elapsed = Date.now() - started;
    expect(rootName).toBe('feed');
    const entries = root.entry as Record<string, unknown>[];
    expect(entries).toHaveLength(count);
    expect(entries[0]['@_n']).toBe('0');
    expect(entries[count - 1]['@_n']).toBe(String(count - 1));
    expect(elapsed).toBeLessThan(2000);
  });

  it('keeps a single child as a value and turns a second one into an array', () => {
    const [, one] = parseXml('<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>a</id></entry></feed>');
    expect(Array.isArray(one.entry)).toBe(false);
    const [, two] = parseXml(
      '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>a</id></entry><atom:entry xmlns:atom="http://www.w3.org/2005/Atom"><id>b</id></atom:entry></feed>',
    );
    expect(two.entry).toHaveLength(2);
  });
});
