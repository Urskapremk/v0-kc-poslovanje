import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { stayUnits } from "./bungalow"
import { findPersonByCheckinToken, mergeGuestFieldsIntoPeople, multiStayUnitForSlot, policePerson, replaceBungalowPeople, stayPeopleForCheckin, writePersonFields } from "./bungalow-people"

const VITOGAZ = "Garden Bungalov III / Garden Bungalov III (2+1); Ocean Bungalow IV - Beach Villa / Ocean Bungalow IV ; Jungle Glamp Village / Jungle Glamp Village 1 (2+0); Jungle Glamp Village / Jungle Glamp Village 2 (2+0)"

describe("stay units on a multi-bungalow booking", () => {
  it("lists VITOGAZ on the four cards it already has", () => {
    assert.deepEqual(stayUnits(VITOGAZ).map(u => u.label), [
      "Garden Bungalow III",
      "Ocean Bungalow IV",
      "Jungle Glamp Village I",
      "Jungle Glamp Village II",
    ])
  })

  it("leaves a single bungalow booking as one unit", () => {
    assert.deepEqual(stayUnits("Ocean Bungalow I").map(u => u.label), ["Ocean Bungalow I"])
  })
})

describe("bungalow people", () => {
  it("maps the first check-in slot to the first bungalow of a multi stay", () => {
    assert.equal(multiStayUnitForSlot(VITOGAZ, "first"), "garden-iii")
    assert.equal(multiStayUnitForSlot(VITOGAZ, "fourth"), "jungle-ii")
    assert.equal(multiStayUnitForSlot("Ocean Bungalow I", "first"), null)
  })

  it("edits one bungalow without rewriting the holder or the other bungalows", () => {
    const holder = "VITOGAZ MADAGASCAR"
    const before = {
      jungle: [{ name: "Ana" }],
      "jungle-ii": [{ name: "Boris" }],
      "garden-iii": [{ name: "Cene" }],
      "ocean-iv": [{ name: "Dora" }],
    }
    const next = replaceBungalowPeople(before, "jungle", [{ name: "Ana Nova", passport: "X1" }])
    assert.equal(holder, "VITOGAZ MADAGASCAR")
    assert.equal(next.jungle[0].name, "Ana Nova")
    assert.equal(next["jungle-ii"][0].name, "Boris")
    assert.equal(next["garden-iii"][0].name, "Cene")
    assert.equal(next["ocean-iv"][0].name, "Dora")
    assert.equal(before.jungle[0].name, "Ana")
  })

  it("writes a check-in slot onto that bungalow only", () => {
    const holder = "VITOGAZ MADAGASCAR"
    const next = mergeGuestFieldsIntoPeople(
      { "jungle-ii": [{ name: "Boris" }] },
      "jungle",
      { guestName: "Ana", passport: "X1" },
    )
    assert.equal(holder, "VITOGAZ MADAGASCAR")
    assert.equal(next.jungle[0].name, "Ana")
    assert.equal(next.jungle[0].passport, "X1")
    assert.equal(next["jungle-ii"][0].name, "Boris")
  })

  it("lists every named guest on bungalow I, not only the first person of each unit", () => {
    const bungalow = "Ocean Bungalov I – for 4 / Ocean Family Bungalov I (4+0); Ocean Bungalow II / Ocean Bungalow II (2+0)"
    const people = {
      "ocean-i": [
        { name: "Kristofer Thorslund" },
        { name: "Mrs. Thorslund" },
        { name: "Child 11 year" },
        { name: "Child 9 year" },
        { name: "" },
      ],
      "ocean-ii": [{ name: "Mrs." }, { name: "Child 13 years" }],
    }
    const listed = stayPeopleForCheckin(bungalow, people)
    assert.deepEqual(listed.map(person => person.name), [
      "Kristofer Thorslund",
      "Mrs. Thorslund",
      "Child 11 year",
      "Child 9 year",
      "Mrs.",
      "Child 13 years",
    ])
    assert.deepEqual(listed.filter(person => person.legacySlot).map(person => person.name), [
      "Kristofer Thorslund",
      "Mrs.",
    ])
    assert.equal(listed.find(person => person.name === "Mrs. Thorslund")?.unitKey, "ocean-i")
    assert.equal(listed.find(person => person.name === "Child 13 years")?.legacySlot, null)
  })

  it("lists every person on Jungle Glamp Village I", () => {
    const bungalow = "Jungle Glamp Village / Jungle Glamp Village 1 (2+0); Jungle Glamp Village / Jungle Glamp Village 2 (2+0)"
    const listed = stayPeopleForCheckin(bungalow, {
      jungle: [{ name: "Ana" }, { name: "Cene" }],
      "jungle-ii": [{ name: "Boris" }],
    })
    assert.deepEqual(listed.map(person => `${person.unitLabel}: ${person.name}`), [
      "Jungle Glamp Village I: Ana",
      "Jungle Glamp Village I: Cene",
      "Jungle Glamp Village II: Boris",
    ])
  })

  it("writes a later person without replacing the first person on that bungalow", () => {
    const next = writePersonFields(
      { "ocean-i": [{ name: "Kristofer Thorslund" }, { name: "Mrs. Thorslund" }] },
      "ocean-i",
      1,
      { guestName: "Mrs. Thorslund", passport: "P2" },
    )
    assert.equal(next["ocean-i"][0].name, "Kristofer Thorslund")
    assert.equal(next["ocean-i"][1].passport, "P2")
    assert.equal(findPersonByCheckinToken({ "ocean-i": [{ name: "A", checkinToken: "abc" }, { name: "B", checkinToken: "def" }] }, "def")?.index, 1)
  })

  it("takes the police person from that bungalow, not the company holder", () => {
    const people = { jungle: [{ name: "Ana", nationality: "France" }] }
    assert.equal(policePerson(people, "jungle")?.name, "Ana")
    assert.equal(policePerson(people, "jungle-ii"), null)
    assert.notEqual(policePerson(people, "jungle")?.name, "VITOGAZ MADAGASCAR")
  })
})
