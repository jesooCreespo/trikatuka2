import type { BrowserContext } from '@playwright/test'
import type { FakeLibrary } from '../e2e/fake-spotify'

/**
 * A realistic but entirely made-up library for the demo screenshots. Every name is invented and
 * covers are generated SVGs served from a reserved `.invalid` domain: nothing real is shown.
 */

const COVER_HOST = 'https://covers.trikatuka.invalid'

/** Deterministic PRNG so every run produces the same screenshots. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const random = rng(20261126)
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!

let coverSeq = 0
function cover(size = 300) {
  const n = coverSeq++
  const a = Math.floor(random() * 360)
  const b = (a + 40 + Math.floor(random() * 120)) % 360
  const shape = n % 4
  return [{ url: `${COVER_HOST}/${a}-${b}-${shape}.svg`, width: size, height: size }]
}

const ARTISTS = [
  'Marlow & the Tidelines',
  'Ines Okafor',
  'Paper Lantern Club',
  'Kite Theory',
  'Saltwater Radio',
  'Juno Ashfield',
  'Midnight Orchard',
  'The Quiet Arcade',
  'Rosa Lindqvist',
  'Northbound Echo',
  'Hollow Sun Ensemble',
  'Pixel Meadow',
  'Tomás Reyes Trio',
  'Amber Coastline',
  'Glass Harbor',
]

const ALBUMS = [
  'Low Tide Letters',
  'Golden Hour Static',
  'Cartographers',
  'Soft Machines',
  'Open Windows',
  'Paper Planes & Satellites',
  'Night Bus Home',
  'Wildflower Season',
  'Analog Hearts',
  'The Long Way Round',
  'Postcards from Nowhere',
  'Blue Room Sessions',
  'Electric Gardens',
  'Slow Summer',
  'Northern Lights, Southern Skies',
  'Small Victories',
  'Weather Report',
  'Second Spring',
]

const TITLE_A = [
  'Paper',
  'Golden',
  'Midnight',
  'Silver',
  'Quiet',
  'Electric',
  'Summer',
  'Velvet',
  'Neon',
  'Northern',
  'Hollow',
  'Wild',
  'Slow',
  'Little',
  'Blue',
  'Brave',
]
const TITLE_B = [
  'Hearts',
  'Rivers',
  'Satellites',
  'Afternoon',
  'Lights',
  'Daydream',
  'Harbor',
  'Echoes',
  'Highway',
  'Letters',
  'Fireflies',
  'Weather',
  'Gardens',
  'Horizon',
  'Signals',
  'Morning',
]

function trackName(i: number) {
  // 16 x 16 unique combinations, more than the 148 songs we need.
  return `${TITLE_A[i % TITLE_A.length]} ${TITLE_B[Math.floor(i / TITLE_A.length) % TITLE_B.length]}`
}

const artistObjects = ARTISTS.map((name, i) => ({
  id: `ar${i}`,
  name,
  uri: `spotify:artist:ar${i}`,
  images: cover(320),
}))

const albumObjects = ALBUMS.map((name, i) => {
  const artist = artistObjects[i % artistObjects.length]!
  return {
    id: `al${i}`,
    name,
    uri: `spotify:album:al${i}`,
    images: cover(),
    artists: [{ id: artist.id, name: artist.name, uri: artist.uri }],
  }
})

const trackObjects = Array.from({ length: 148 }, (_, i) => {
  const album = pick(albumObjects)
  const artist = album.artists[0]!
  return {
    id: `tr${i}`,
    name: trackName(i),
    uri: `spotify:track:tr${i}`,
    type: 'track',
    artists: [artist],
    album: { name: album.name, images: album.images },
  }
})

const OLD = { id: 'sam.rivera', display_name: 'Sam Rivera' }
const NEW = { id: 'sam.rivera.2026', display_name: 'Sam Rivera' }

interface PlaylistSpec {
  id: string
  name: string
  owner: { id: string; display_name: string }
  collaborative?: boolean
  public?: boolean
  size: number
  description?: string
}

const PLAYLISTS: PlaylistSpec[] = [
  { id: 'pl-road', name: 'Road trip 2025', owner: OLD, size: 42, description: 'Windows down.' },
  { id: 'pl-sunday', name: 'Sunday morning', owner: OLD, size: 27 },
  { id: 'pl-focus', name: 'Focus · deep work', owner: OLD, size: 64, public: false },
  { id: 'pl-run', name: 'Running 160 BPM', owner: OLD, size: 38 },
  {
    id: 'pl-office',
    name: 'Office radio',
    owner: OLD,
    size: 55,
    collaborative: true,
    public: false,
  },
  {
    id: 'pl-fresh',
    name: 'Fresh Finds Weekly',
    owner: { id: 'curated', display_name: 'Curated Sounds' },
    size: 50,
  },
  { id: 'pl-dinner', name: 'Dinner with friends', owner: OLD, size: 31 },
  { id: 'pl-rain', name: 'Rainy day jazz', owner: OLD, size: 22 },
  {
    id: 'pl-acoustic',
    name: 'Acoustic covers',
    owner: { id: 'mellow', display_name: 'Mellow Club' },
    size: 80,
  },
  { id: 'pl-summer', name: "Summer '24", owner: OLD, size: 46 },
  {
    id: 'pl-book',
    name: 'Book club soundtrack',
    owner: { id: 'lena.k', display_name: 'Lena K.' },
    size: 19,
    collaborative: true,
  },
  { id: 'pl-lofi', name: 'Lo-fi to study', owner: OLD, size: 73, public: false },
  {
    id: 'pl-night',
    name: 'Late night drive',
    owner: { id: 'nightowl', display_name: 'Night Owl' },
    size: 60,
  },
  { id: 'pl-indie', name: 'Indie discoveries', owner: OLD, size: 35 },
  {
    id: 'pl-classical',
    name: 'Classical essentials',
    owner: { id: 'orchestra.fm', display_name: 'Orchestra FM' },
    size: 100,
  },
  {
    id: 'pl-wedding',
    name: 'Wedding playlist',
    owner: OLD,
    size: 58,
    description: 'First dance included.',
  },
]

const playlists = PLAYLISTS.map((p) => ({
  id: p.id,
  name: p.name,
  uri: `spotify:playlist:${p.id}`,
  public: p.public ?? true,
  collaborative: p.collaborative ?? false,
  description: p.description ?? null,
  images: cover(),
  owner: p.owner,
  items: { total: p.size },
}))

/** The old user can read items of playlists they own or collaborate on. */
const playlistItems = Object.fromEntries(
  PLAYLISTS.filter((p) => p.owner.id === OLD.id || p.collaborative).map((p) => [
    p.id,
    Array.from({ length: p.size }, () => ({
      added_at: '2025-06-01T10:00:00Z',
      is_local: false,
      item: pick(trackObjects),
    })),
  ]),
)

const avatar = (initial: string, hue: number) => [
  { url: `${COVER_HOST}/avatar-${initial}-${hue}.svg`, width: 300, height: 300 },
]

export const DEMO_LIBRARY: FakeLibrary = {
  users: {
    old: { ...OLD, uri: `spotify:user:${OLD.id}`, images: avatar('S', 200) },
    new: { ...NEW, uri: `spotify:user:${NEW.id}`, images: avatar('S', 150) },
  },
  playlists,
  playlistItems,
  tracks: trackObjects.map((track) => ({ added_at: '2025-06-01T10:00:00Z', track })),
  albums: albumObjects.map((album) => ({ added_at: '2025-06-01T10:00:00Z', album })),
  artists: artistObjects,
  shows: [
    'Slow History',
    'Kitchen Science',
    'The Tiny Experiments Hour',
    'Notes from the Field',
    'Design, Briefly',
    'Weekend Long Reads',
  ].map((name, i) => ({
    added_at: '2025-06-01T10:00:00Z',
    show: { id: `sh${i}`, name, uri: `spotify:show:sh${i}`, images: cover() },
  })),
  // The new account already has a few songs and an album: they get skipped.
  targetSaved: [...trackObjects.slice(0, 12).map((t) => t.uri), albumObjects[0]!.uri],
}

/** Two playlists whose follow is refused, so the report shows what a failure looks like. */
export const DEMO_FAILURES = ['spotify:playlist:pl-acoustic', 'spotify:playlist:pl-night']

function coverSvg(name: string) {
  const avatarMatch = name.match(/^avatar-(\w)-(\d+)$/)
  if (avatarMatch) {
    const [, initial, hue] = avatarMatch
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue} 55% 45%)"/><text x="50" y="64" font-family="system-ui,sans-serif" font-size="44" font-weight="600" fill="#fff" text-anchor="middle">${initial}</text></svg>`
  }
  const [a, b, shape] = name.split('-').map(Number) as [number, number, number]
  const shapes = [
    `<circle cx="66" cy="38" r="22" fill="hsl(${b} 85% 85% / .55)"/>`,
    `<path d="M0 72 Q25 52 50 72 T100 72 V100 H0Z" fill="hsl(${b} 80% 88% / .5)"/>`,
    `<rect x="22" y="22" width="56" height="56" rx="6" transform="rotate(14 50 50)" fill="none" stroke="hsl(${b} 90% 90% / .6)" stroke-width="5"/>`,
    `<g fill="hsl(${b} 90% 92% / .5)"><circle cx="30" cy="30" r="8"/><circle cx="70" cy="45" r="12"/><circle cx="40" cy="74" r="10"/></g>`,
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 65% 52%)"/><stop offset="1" stop-color="hsl(${b} 60% 32%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${shapes[shape]}</svg>`
}

/** Serves the generated covers. */
export async function installDemoCovers(context: BrowserContext) {
  await context.route(`${COVER_HOST}/**`, (route) => {
    const name = new URL(route.request().url()).pathname.slice(1).replace(/\.svg$/, '')
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: coverSvg(name) })
  })
}
