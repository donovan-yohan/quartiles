import { describe, expect, it } from 'vitest'
import { validateSourcePuzzle } from './daily-puzzle-source.mjs'

const duplicateConfiguredQuartetWordPuzzle = {
  date: '2099-01-01',
  quartets: [
    ['ab', 'cd', 'ef', 'ghij'],
    ['abc', 'de', 'fg', 'hij'],
    ['kl', 'mn', 'op', 'qr'],
    ['st', 'uv', 'wx', 'yz'],
    ['za', 'yb', 'xc', 'wd'],
  ],
}

describe('daily puzzle source validation', () => {
  it('rejects duplicate configured quartet words even when segmentations use different exact paths', () => {
    expect(() => validateSourcePuzzle(duplicateConfiguredQuartetWordPuzzle)).toThrow(
      /2099-01-01: configured quartet words must be unique.*abcdefghij \[0,1,2,3\] \(ab\+cd\+ef\+ghij\).*abcdefghij \[4,5,6,7\] \(abc\+de\+fg\+hij\)/,
    )
  })
})
