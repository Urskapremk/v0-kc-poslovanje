import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { neighborLineId } from "./payment-list-place"

describe("neighborLineId", () => {
  const lines = ["thb", "water", "lokobe-a", "lokobe-b"]

  it("keeps focus on the next line after a middle row is removed", () => {
    assert.equal(neighborLineId(lines, "water"), "lokobe-a")
    assert.equal(neighborLineId(lines, "lokobe-a"), "lokobe-b")
  })

  it("keeps focus on the previous line when the last row is removed", () => {
    assert.equal(neighborLineId(lines, "lokobe-b"), "lokobe-a")
  })

  it("has nowhere to go when that was the only line", () => {
    assert.equal(neighborLineId(["thb"], "thb"), null)
  })

  it("ignores an id that is not in the list", () => {
    assert.equal(neighborLineId(lines, "missing"), null)
  })
})
