export function formatLocationText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[^\p{L}\p{N}]+)([\p{L}\p{N}])/gu, (_match, separator: string, firstCharacter: string) =>
      `${separator}${firstCharacter.toLocaleUpperCase('tr-TR')}`,
    )
}

export function parseLocations(value: string): string[] {
  return [...new Set(
    value
      .split(',')
      .map(item => formatLocationText(item.trim()))
      .filter(Boolean),
  )]
}
