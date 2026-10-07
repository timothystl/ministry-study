import { describe, expect, it } from 'vitest'
import { briefForWriter, briefFromSermon } from './sermonBrief'

const sermon = `The Lost Sheep Goes Looking
Luke 15:1–7

Some of you came in this morning carrying more than your coat. You came carrying a quiet fear that you are the one who wandered too far.

The shepherd does not send a search party and he does not scold. He leaves the ninety-nine and goes after the one. Fear says you are too far gone. The shepherd says you are found.

Jesus does not wait for us to repent our way home. He lifts the lost sheep onto his shoulders, and the cross is where that carrying cost him everything. Forgiveness is not a reward for the found; forgiveness is how we were found.

So hear it again, this morning, for you: your sins are forgiven, and Christ has carried you home. Go in peace, and rejoice with heaven, because the one who was lost is you.`

describe('sermon brief', () => {
  const brief = briefFromSermon(sermon, '0042_Lost Sheep.docx')
  it('finds the title, passage and themes', () => {
    expect(brief.title).toBe('The Lost Sheep Goes Looking')
    expect(brief.scripture).toBe('Luke 15:1–7')
    expect(brief.themes).toContain('forgiveness')
    expect(brief.themes).toContain('fear')
  })
  it('finds where the gospel lands and how it opens and closes', () => {
    expect(brief.gospel).toMatch(/forgiven|Christ|for you/)
    expect(brief.opening).toMatch(/carrying more than your coat/)
    expect(brief.closing).toMatch(/Go in peace/)
  })
  it('falls back to the file name for a title, and refuses an empty file', () => {
    expect(
      briefFromSermon(
        'A long first paragraph that ends like a sentence, so it is not a title.',
        '0042_Lost Sheep.docx',
      ).title,
    ).toBe('Lost Sheep')
    expect(() => briefFromSermon('   \n ')).toThrow('empty')
  })
  it('writes a note for the Prayer Writer', () => {
    const note = briefForWriter(brief)
    expect(note).toContain('Text: Luke 15:1–7')
    expect(note).toContain('Themes: Forgiveness')
    expect(note).toContain('Lord, in your mercy,')
  })
})
