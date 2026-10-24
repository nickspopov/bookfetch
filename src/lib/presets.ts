export interface Preset {
  id: string;
  name: string;
  url: string;
  subtitle: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'gutenberg',
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/ebooks.opds/',
    subtitle: '70,000+ free public-domain books',
  },
  {
    id: 'sample',
    name: 'Bookfetch Sample Library',
    url: 'https://nickpopov.com/bookfetch/opds/catalog.xml',
    subtitle: 'A few public-domain classics to try the app',
  },
];

export const presetById = (id: string | undefined) => PRESETS.find((p) => p.id === id);
