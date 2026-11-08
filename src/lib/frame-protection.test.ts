import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('frame protection', () => {
  const toml = readFileSync(resolve('netlify.toml'), 'utf8')

  it('covers every static file in netlify.toml', () => {
    const block = /for = "\/\*"\s+\[headers\.values\]([\s\S]*?)(?:\[\[|$)/.exec(
      toml,
    )?.[1]
    expect(block).toContain('X-Frame-Options = "DENY"')
    expect(block).toContain(
      'Content-Security-Policy = "frame-ancestors \'none\'"',
    )
  })

  it('does not enforce a full content security policy', () => {
    expect(toml).not.toMatch(/default-src|script-src/)
  })
})
