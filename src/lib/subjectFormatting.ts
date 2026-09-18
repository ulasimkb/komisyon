export function formatSubjectTitle(value: string): string {
  return value.toLocaleUpperCase('tr-TR')
}

export function findSubjectTitleSuggestions(value: string, titles: string[], limit = 6): string[] {
  const query = formatSubjectTitle(value.trim())
  if (!query) return []

  return [...new Set(titles
    .map(title => formatSubjectTitle(title.trim()))
    .filter(Boolean))]
    .filter(title => title.startsWith(query) && title !== query)
    .sort((left, right) => left.localeCompare(right, 'tr-TR'))
    .slice(0, limit)
}
