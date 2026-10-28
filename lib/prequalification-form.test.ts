import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PREQUALIFICATION_ROWS, prequalificationValue } from './prequalification-form.ts'

describe('prequalification values', () => {
  it('fills only the cells read from each company and leaves the rest empty', () => {
    const answerIds = PREQUALIFICATION_ROWS.flatMap((row) => row.type === 'field' ? [row.id] : [])
    for (const company of ['tourism', 'sarl'] as const) {
      for (const id of ['created', 'payment', 'staffCount', 'contactName', 'activity'] ) {
        if (company === 'tourism' && id === 'activity') continue
        assert.equal(prequalificationValue(company, id), '')
      }
      assert.ok(prequalificationValue(company, 'nif'))
      assert.ok(prequalificationValue(company, 'account'))
    }
    assert.notEqual(prequalificationValue('tourism', 'nif'), prequalificationValue('sarl', 'nif'))
    assert.equal(prequalificationValue('sarl', 'activity'), '')
    assert.equal(answerIds.includes('nif'), true)
  })
})
