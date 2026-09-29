/** Ultimate Guitar title search for a song (UG has no public API, so we link to search). */
export function ugSearchUrl(title: string, artist: string): string {
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(`${title} ${artist}`)}`;
}
