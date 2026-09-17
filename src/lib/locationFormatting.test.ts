import { describe, expect, it } from 'vitest'
import { formatLocationText, parseLocations } from './locationFormatting'

describe('formatLocationText', () => {
  it('her kelimenin ilk harfini Türkçe kurallarla büyütür', () => {
    expect(formatLocationText('istiklal caddesi, ZAFER MEYDANI')).toBe('İstiklal Caddesi, Zafer Meydanı')
    expect(formatLocationText('IŞIK sokak')).toBe('Işık Sokak')
  })

  it('tire ve nokta sonrasındaki sözcükleri de biçimlendirir', () => {
    expect(formatLocationText('dumlupınar-üniversitesi 1. kapı')).toBe('Dumlupınar-Üniversitesi 1. Kapı')
  })
})

describe('parseLocations', () => {
  it('virgülle ayrılan konumları biçimlendirir, boşları ve tekrarları kaldırır', () => {
    expect(parseLocations('osmanlı caddesi, OSMANLI CADDESİ, zafer meydanı, ')).toEqual([
      'Osmanlı Caddesi',
      'Zafer Meydanı',
    ])
  })
})
