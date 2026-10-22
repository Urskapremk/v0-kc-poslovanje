import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ASSET_CAT,
  LOAN_CAT,
  WIP_CAT,
  boatCostDraftDiffers,
  dilipBoatCostDescription,
  isTransportCostPayRef,
  planBoatCostLink,
  resolveBoatCostMark,
  transportCostDescription,
  transportPayCancelConfirm,
  transportPayConfirm,
  transportPaySaveLabel,
  type StoredBoatCost,
} from "./dilip-boat-cost"

const empty: StoredBoatCost = { category: "", assetId: "", fixedAssetId: "", orderItemId: "" }

describe("isTransportCostPayRef", () => {
  it("matches Dilip, voznik and nosači on a nabava trip", () => {
    assert.equal(isTransportCostPayRef("nabava:nab-1:boat"), true)
    assert.equal(isTransportCostPayRef("nabava:nab-1:boatdriver"), true)
    assert.equal(isTransportCostPayRef("nabava:nab-1:porters"), true)
    assert.equal(isTransportCostPayRef("nabava:nab-1:tuctuc"), false)
    assert.equal(isTransportCostPayRef("transfer:res:arrival:boatdriver"), false)
    assert.equal(isTransportCostPayRef("transfer:res:arrival:porters"), false)
    assert.equal(isTransportCostPayRef("reception:ord:porters"), false)
    assert.equal(isTransportCostPayRef("excursion:group:dilip"), false)
  })
})

describe("resolveBoatCostMark", () => {
  it("clears when unmarked", () => {
    assert.deepEqual(resolveBoatCostMark({ category: "" }), { ok: true, mark: { kind: "none" } })
    assert.deepEqual(resolveBoatCostMark(null), { ok: true, mark: { kind: "none" } })
  })

  it("requires a pogodba for sredstvo v izdelavi", () => {
    const missing = resolveBoatCostMark({ category: WIP_CAT, assetId: "  " })
    assert.equal(missing.ok, false)
    const ok = resolveBoatCostMark({ category: WIP_CAT, assetId: "fa-1" })
    assert.deepEqual(ok, { ok: true, mark: { kind: "wip", category: WIP_CAT, assetId: "fa-1" } })
  })

  it("requires a rate for osnovno sredstvo and a guest for a loan", () => {
    assert.equal(resolveBoatCostMark({ category: ASSET_CAT, annualRatePct: 0 }).ok, false)
    assert.equal(resolveBoatCostMark({ category: LOAN_CAT, reservationId: "r1" }).ok, false)
    assert.equal(resolveBoatCostMark({ category: "kuhinja" }).ok, true)
    assert.equal(resolveBoatCostMark({ category: "ni-kategorije" }).ok, false)
  })
})

describe("planBoatCostLink", () => {
  it("keeps a single contract row when the pogodba changes", () => {
    const prev: StoredBoatCost = { ...empty, category: WIP_CAT, assetId: "fa-1" }
    const next = resolveBoatCostMark({ category: WIP_CAT, assetId: "fa-2" })
    assert.equal(next.ok, true)
    if (!next.ok) return
    assert.deepEqual(planBoatCostLink(prev, next.mark), { wip: "upsert", fixedAsset: "none", loan: "none" })
  })

  it("removes the contract link when the mark is cleared", () => {
    const prev: StoredBoatCost = { ...empty, category: WIP_CAT, assetId: "fa-1" }
    const next = resolveBoatCostMark({ category: "" })
    assert.equal(next.ok, true)
    if (!next.ok) return
    assert.equal(planBoatCostLink(prev, next.mark).wip, "remove")
  })

  it("does not keep a contract link and a fixed asset at the same time", () => {
    const prev: StoredBoatCost = { ...empty, category: ASSET_CAT, fixedAssetId: "fa-own" }
    const next = resolveBoatCostMark({ category: WIP_CAT, assetId: "fa-pogodba" })
    assert.equal(next.ok, true)
    if (!next.ok) return
    assert.deepEqual(planBoatCostLink(prev, next.mark), { wip: "upsert", fixedAsset: "delete", loan: "none" })
  })

  it("updates one fixed asset instead of creating a second", () => {
    const prev: StoredBoatCost = { ...empty, category: ASSET_CAT, fixedAssetId: "fa-own" }
    const next = resolveBoatCostMark({ category: ASSET_CAT, annualRatePct: 20 })
    assert.equal(next.ok, true)
    if (!next.ok) return
    assert.equal(planBoatCostLink(prev, next.mark).fixedAsset, "update")
  })

  it("replaces the guest loan line instead of adding another", () => {
    const prev: StoredBoatCost = { ...empty, category: LOAN_CAT, orderItemId: "ord-1" }
    const next = resolveBoatCostMark({ category: LOAN_CAT, reservationId: "g2", loanRate: 4800 })
    assert.equal(next.ok, true)
    if (!next.ok) return
    assert.equal(planBoatCostLink(prev, next.mark).loan, "replace")
  })

  it("drops the loan when the kind changes to a department cost", () => {
    const prev: StoredBoatCost = { ...empty, category: LOAN_CAT, orderItemId: "ord-1" }
    const next = resolveBoatCostMark({ category: "kuhinja" })
    assert.equal(next.ok, true)
    if (!next.ok) return
    assert.deepEqual(planBoatCostLink(prev, next.mark), { wip: "none", fixedAsset: "none", loan: "delete" })
  })
})

describe("dilipBoatCostDescription", () => {
  it("names the Nero boat payment on the contract", () => {
    assert.equal(dilipBoatCostDescription(""), "Dilip (čoln Nero)")
    assert.equal(dilipBoatCostDescription("nabava"), "Dilip (čoln Nero)")
    assert.equal(dilipBoatCostDescription("les za tla"), "Dilip (čoln Nero) — les za tla")
  })
})

describe("transportCostDescription", () => {
  it("names voznik and nosači without a second row title", () => {
    assert.equal(transportCostDescription("nabava:1:boat", "nabava"), "Dilip (čoln Nero)")
    assert.equal(transportCostDescription("nabava:1:boatdriver", "Voznik čolna — nabava"), "Voznik čolna")
    assert.equal(transportCostDescription("nabava:1:boatdriver", "Voznik čolna — les"), "Voznik čolna — les")
    assert.equal(transportCostDescription("nabava:1:porters", "Nosači — nabava"), "Nosači")
    assert.equal(transportCostDescription("nabava:1:tuctuc", "Tuc tuc — nabava"), "Dilip (čoln Nero) — Tuc tuc — nabava")
  })
})

describe("boatCostDraftDiffers", () => {
  it("ignores a date-only edit and notices a pogodba change", () => {
    const prev = { category: WIP_CAT, assetId: "fa-1" }
    assert.equal(boatCostDraftDiffers(prev, prev), false)
    assert.equal(boatCostDraftDiffers({ category: WIP_CAT, assetId: "fa-2" }, prev), true)
    assert.equal(boatCostDraftDiffers({ category: "" }, prev), true)
  })
})

describe("transport pay copy", () => {
  it("uses Shrani only when correcting, and confirms a new pogodba", () => {
    assert.equal(transportPaySaveLabel(true, false), "Shrani")
    assert.equal(transportPaySaveLabel(true, true), "Shranjujem…")
    assert.equal(transportPaySaveLabel(false, false), "Zabeleži plačilo")
    assert.equal(transportPayConfirm({
      editing: true, changed: false, category: WIP_CAT, hadCategory: true, amountLabel: "120.000 Ar", dilip: true,
    }), null)
    assert.equal(transportPayConfirm({
      editing: true, changed: true, category: WIP_CAT, hadCategory: false, amountLabel: "40.000 Ar", dilip: false,
    }), "Shranim in dodam 40.000 Ar k stroškom izbrane pogodbe?")
    assert.equal(transportPayConfirm({
      editing: true, changed: true, category: "", hadCategory: true, amountLabel: "1", dilip: false,
    }), "Odstranim oznako stroška? Plačilo ostane zabeleženo.")
    assert.equal(transportPayCancelConfirm({ wip: true, dilip: false }), "Prekličem plačilo? Vknjižba se izbriše in strošek se umakne s pogodbe.")
  })
})
