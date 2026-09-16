import { describe, expect, it } from 'vitest'
import { municipalDirectorates, normalizeResponsibleUnits } from './municipalUnits'
import { kutahyaNeighborhoods } from './neighborhoods'

describe('municipal directorates', () => {
  it('keeps the two operational units at the top of the official list', () => {
    expect(municipalDirectorates.slice(0, 2)).toEqual([
      'Ulaşım Hizmetleri Müdürlüğü',
      'Fen İşleri Müdürlüğü',
    ])
    expect(new Set(municipalDirectorates).size).toBe(municipalDirectorates.length)
  })

  it('upgrades a legacy single unit and removes duplicates', () => {
    expect(normalizeResponsibleUnits(undefined, 'Ulaşım Hizmetleri Müdürlüğü')).toEqual(['Ulaşım Hizmetleri Müdürlüğü'])
    expect(normalizeResponsibleUnits(['Fen İşleri Müdürlüğü', 'Fen İşleri Müdürlüğü'])).toEqual(['Fen İşleri Müdürlüğü'])
  })

  it('keeps the supplied neighborhood list unique', () => {
    expect(kutahyaNeighborhoods[0]).toBe('100. Yıl')
    expect(new Set(kutahyaNeighborhoods).size).toBe(kutahyaNeighborhoods.length)
    expect(kutahyaNeighborhoods.filter(name => name === 'Gültepe')).toHaveLength(1)
  })
})
