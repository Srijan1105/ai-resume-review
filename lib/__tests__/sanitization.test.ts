/**
 * Tests for stripHtml()
 *
 * Task 11.1 — Property 7: Input sanitization removes HTML before AI processing
 *
 * **Validates: Requirements 3.9**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { stripHtml } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Task 11.1 — Property 7: Input sanitization removes HTML before AI processing
// Validates: Requirements 3.9
// ---------------------------------------------------------------------------
describe('Property 7: Input sanitization removes HTML before AI processing', () => {
  it('stripHtml output contains no < or > characters when HTML tags are injected', () => {
    // Arbitrary HTML tags to inject into a plain-text base
    const htmlTags = fc.constantFrom(
      '<p>',
      '</p>',
      '<b>',
      '</b>',
      '<div class="x">',
      '</div>',
      '<span id="foo">',
      '</span>',
      '<br/>',
      '<img src="x" onerror="alert(1)">',
      '<script>alert(1)</script>',
      '<a href="http://example.com">',
      '</a>',
    )

    fc.assert(
      fc.property(
        // Base text must NOT contain < or > so that any < or > in the
        // result can only have come from the injected tags.
        fc.stringMatching(/^[^<>]*$/),
        fc.array(htmlTags, { minLength: 1, maxLength: 5 }),  // at least one tag injected
        (baseText, tags) => {
          // Interleave base text with injected tags
          const textWithHtml = baseText + tags.join(baseText)

          const result = stripHtml(textWithHtml)

          // After stripping, no < or > should remain
          return !result.includes('<') && !result.includes('>')
        }
      )
    )
  })

  it('non-HTML text is returned unchanged by stripHtml', () => {
    fc.assert(
      fc.property(
        // Generate strings that contain no < or > characters
        fc.stringMatching(/^[^<>]*$/),
        (plainText) => {
          const result = stripHtml(plainText)
          return result === plainText
        }
      )
    )
  })
})

// ---------------------------------------------------------------------------
// Unit tests — concrete examples
// ---------------------------------------------------------------------------
describe('stripHtml — unit tests', () => {
  it('removes a simple paragraph tag', () => {
    expect(stripHtml('<p>Hello world</p>')).toBe('Hello world')
  })

  it('removes nested tags, preserving text content', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  it('removes self-closing tags', () => {
    expect(stripHtml('Line 1<br/>Line 2')).toBe('Line 1Line 2')
  })

  it('removes tags with attributes', () => {
    expect(stripHtml('<div class="container">Text</div>')).toBe('Text')
  })

  it('removes script tags and their content tags', () => {
    // Note: the regex removes the tags but leaves the inner text of script
    expect(stripHtml('<script>alert(1)</script>rest')).toBe('alert(1)rest')
  })

  it('returns an empty string unchanged', () => {
    expect(stripHtml('')).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(stripHtml('Hello world')).toBe('Hello world')
  })

  it('handles multiple tags on a single string', () => {
    expect(stripHtml('<h1>Title</h1><p>Body</p>')).toBe('TitleBody')
  })

  it('handles a string that is only tags with no text', () => {
    expect(stripHtml('<p></p>')).toBe('')
  })
})
