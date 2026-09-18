import { describe, expect, it } from 'vitest'
import { findSubjectTitleSuggestions, formatSubjectTitle } from './subjectFormatting'

describe('formatSubjectTitle', () => {
  it('başlığı Türkçe büyük harf kurallarıyla biçimlendirir', () => {
    expect(formatSubjectTitle('İstiklal caddesi ışıklandırması')).toBe('İSTİKLAL CADDESİ IŞIKLANDIRMASI')
    expect(formatSubjectTitle('ulaşım işi')).toBe('ULAŞIM İŞİ')
  })
})

describe('findSubjectTitleSuggestions', () => {
  it('ilk karakterden itibaren eşleşen eski başlıkları tekilleştirir', () => {
    expect(findSubjectTitleSuggestions('u', [
      'Ulaşım düzenlemesi',
      'ulaşım düzenlemesi',
      'Üst geçit çalışması',
      'Yol bakımı',
    ])).toEqual(['ULAŞIM DÜZENLEMESİ'])
  })

  it('tam olarak yazılmış başlığı yeniden önermez', () => {
    expect(findSubjectTitleSuggestions('YOL BAKIMI', ['Yol bakımı'])).toEqual([])
  })
})
