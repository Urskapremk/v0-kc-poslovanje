'use client'

import React, { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Award, Printer, RotateCcw, GraduationCap, FileCheck2 } from 'lucide-react'
import { getAllStaffMembers } from '@/app/actions/statistics'
import { getMgCompany } from '@/lib/payroll-mg'
import { buildCertificateHtml } from '@/lib/certifikat-doc'
import { buildCertificatTravailHtml } from '@/lib/certifikat-travail-doc'

// Barvni logo vgradimo kot data URI, da se ZANESLJIVO natisne (enak vzorec kot ostali dokumenti).
async function loadLogoDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch('/images/komba-logo-color.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

type Gender = 'f' | 'm'

// Spolno prilagojeni zaimki.
function pronouns(g: Gender) {
  return g === 'f'
    ? { subj: 'she', poss: 'her' }
    : { subj: 'he', poss: 'his' }
}

// Privzeta vloga glede na spol (za restavracijo).
const DEFAULT_ROLE: Record<Gender, string> = { f: 'waitress', m: 'waiter' }

// Predlagana delovna mesta (spolno prilagojena) + pripadajoče področje/oddelek.
type Position = {
  key: string; label: string; roleF: string; roleM: string; area: string
  roleFrF: string; roleFrM: string
}
const POSITIONS: Position[] = [
  { key: 'waiter', label: 'Natakar/-ica', roleF: 'waitress', roleM: 'waiter', area: 'restaurant', roleFrF: 'serveuse', roleFrM: 'serveur' },
  { key: 'receptionist', label: 'Recepcija', roleF: 'receptionist', roleM: 'receptionist', area: 'reception', roleFrF: 'réceptionniste', roleFrM: 'réceptionniste' },
  { key: 'housekeeper', label: 'Sobarica / čiščenje', roleF: 'housekeeper', roleM: 'housekeeper', area: 'housekeeping department', roleFrF: 'femme de chambre', roleFrM: 'valet de chambre' },
  { key: 'cook', label: 'Kuhar/-ica', roleF: 'cook', roleM: 'cook', area: 'kitchen', roleFrF: 'cuisinière', roleFrM: 'cuisinier' },
  { key: 'kitchen_assistant', label: 'Pomočnik/-ca v kuhinji', roleF: 'kitchen assistant', roleM: 'kitchen assistant', area: 'kitchen', roleFrF: 'aide-cuisinière', roleFrM: 'aide-cuisinier' },
  { key: 'barman', label: 'Točaj/-ica (bar)', roleF: 'barmaid', roleM: 'barman', area: 'bar', roleFrF: 'barmaid', roleFrM: 'barman' },
  { key: 'gardener', label: 'Vrtnar/-ica', roleF: 'gardener', roleM: 'gardener', area: 'grounds and gardens', roleFrF: 'jardinière', roleFrM: 'jardinier' },
  { key: 'skipper', label: 'Skiper / čoln', roleF: 'boat skipper', roleM: 'boat skipper', area: 'water activities', roleFrF: 'capitaine de bateau', roleFrM: 'capitaine de bateau' },
]
function positionRole(key: string, g: Gender): string {
  const p = POSITIONS.find((x) => x.key === key)
  if (!p) return ''
  return g === 'f' ? p.roleF : p.roleM
}
function positionRoleFr(key: string, g: Gender): string {
  const p = POSITIONS.find((x) => x.key === key)
  if (!p) return ''
  return g === 'f' ? p.roleFrF : p.roleFrM
}

// Francoski datum, npr. "01 Août 2024".
const MONTHS_FR_FULL = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
function formatDateFr(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_FR_FULL[d.getMonth()]} ${d.getFullYear()}`
}

// Ustvari privzete odstavke certifikata iz vnosov.
function buildDefaultBody(g: Gender, role: string, area: string): string {
  const p = pronouns(g)
  const roleTxt = role.trim() || DEFAULT_ROLE[g]
  const areaTxt = area.trim() || 'restaurant'
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return [
    `has successfully completed ${p.poss} internship as a ${roleTxt} at the ${areaTxt} of Komba Cabana Lodge.`,
    `During this period, ${p.subj} demonstrated seriousness, motivation, professionalism and an excellent sense of customer service.`,
    `${cap(p.subj)} actively participated in welcoming guests, preparing tables, serving food and beverages, and in the smooth daily operation of the ${areaTxt}.`,
    `Thanks to ${p.poss} dedication and commitment, ${p.subj} has acquired valuable practical skills in the field of hospitality, service and ${areaTxt} operations.`,
  ].join('\n\n')
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateEn(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function CertifikatTab() {
  const { data: staff } = useSWR('all-staff-members', getAllStaffMembers)
  const activeStaff = useMemo(() => (staff ?? []).filter((s) => s.active), [staff])
  const staffDisplayName = (s: (typeof activeStaff)[number]) =>
    `${s.lastName || ''} ${s.firstName || ''}`.trim() || s.staffName

  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('f')

  // Ob izbiri zaposlenega samodejno napolni ime + spol (zaimke) in ponastavi besedilo.
  function handleSelectStaff(id: string) {
    setSelectedStaffId(id)
    if (!id) return
    const s = activeStaff.find((m) => m.id === id)
    if (!s) return
    setName(staffDisplayName(s))
    if (s.gender === 'Z') setGender('f')
    else if (s.gender === 'M') setGender('m')
    setBodyOverride(null)
  }
  const [positionKey, setPositionKey] = useState('waiter')
  const [role, setRole] = useState('')
  const [area, setArea] = useState('restaurant')

  // Efektivna vloga: če je izbrano predlagano mesto, jo izpeljemo spolno; sicer ročni vnos.
  const effectiveRole = positionKey ? positionRole(positionKey, gender) : role

  // Ob izbiri predlaganega delovnega mesta napolni področje in ponastavi besedilo.
  function handleSelectPosition(key: string) {
    setPositionKey(key)
    const p = POSITIONS.find((x) => x.key === key)
    if (p) setArea(p.area)
    setBodyOverride(null)
  }
  const [place, setPlace] = useState('Nosy Komba')
  const [dateISO, setDateISO] = useState(todayISO())
  const [conclusion, setConclusion] = useState(
    'The internship was completed successfully and to our entire satisfaction.',
  )
  const [bodyOverride, setBodyOverride] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  // Način dokumenta: 'praksa' = Certifikat o praksi (EN), 'zaposlitev' = Certificat de travail (FR).
  const [mode, setMode] = useState<'praksa' | 'zaposlitev'>('praksa')

  // Polja za potrdilo o zaposlitvi (Certificat de travail).
  const [tCompany, setTCompany] = useState<'sarl' | 'tourism'>('sarl')
  const [tName, setTName] = useState('')
  const [tGender, setTGender] = useState<Gender>('f')
  const [tPositionKey, setTPositionKey] = useState('housekeeper')
  const [tQualiteOverride, setTQualiteOverride] = useState<string | null>(null)
  const [tStartISO, setTStartISO] = useState('')
  const [tEndISO, setTEndISO] = useState('')
  const [tClassification, setTClassification] = useState('')
  const [tIndice, setTIndice] = useState('')
  const [tPlace, setTPlace] = useState('Nosy-Be')
  const [tDateISO, setTDateISO] = useState(todayISO())

  const tQualite = tQualiteOverride ?? positionRoleFr(tPositionKey, tGender)

  // Ob izbiri zaposlenega napolni polja potrdila o zaposlitvi.
  function handleSelectStaffTravail(id: string) {
    setSelectedStaffId(id)
    if (!id) return
    const s = activeStaff.find((m) => m.id === id)
    if (!s) return
    // Ime v obliki PRIIMEK Ime (kot na referenci).
    const lastUp = (s.lastName || '').toUpperCase()
    setTName(`${lastUp} ${s.firstName || ''}`.trim() || s.staffName)
    if (s.gender === 'Z') setTGender('f')
    else if (s.gender === 'M') setTGender('m')
    if (s.startDate) setTStartISO(String(s.startDate).slice(0, 10))
    if (s.endDate) setTEndISO(String(s.endDate).slice(0, 10))
    if (s.wageCategory) setTClassification(s.wageCategory)
    setTQualiteOverride(null)
  }

  // Skupni pomočnik za tiskanje HTML dokumenta prek skritega iframe-a.
  function printHtmlDoc(html: string) {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 400)
  }

  async function handlePrintTravail() {
    setPrinting(true)
    try {
      const logoDataUrl = await loadLogoDataUrl()
      const companyName = tCompany === 'tourism' ? 'SARL KOMBA CABANA TOURISM' : 'SARL KOMBA CABANA'
      const html = buildCertificatTravailHtml({
        companyLines: [companyName, 'ANDREKAREKA', 'NOSY BE'],
        companyName,
        representative: 'RETELJ Borut',
        representativeCivility: 'Monsieur',
        employeeName: tName.trim() || '—',
        gender: tGender,
        qualite: tQualite.trim() || '—',
        startLabel: formatDateFr(tStartISO),
        endLabel: formatDateFr(tEndISO),
        classification: tClassification.trim(),
        indice: tIndice.trim(),
        placeLabel: tPlace.trim() || 'Nosy-Be',
        dateLabel: formatDateFr(tDateISO),
        signatoryRole: 'Le Gérant',
        signatoryName: 'RETELJ Borut',
        lodgeName: 'KOMBA CABANA LODGE',
        locationLine: 'NOSY KOMBA · MADAGASCAR',
        logoDataUrl,
      })
      printHtmlDoc(html)
    } finally {
      setPrinting(false)
    }
  }

  const defaultBody = useMemo(
    () => buildDefaultBody(gender, effectiveRole, area),
    [gender, effectiveRole, area],
  )
  const body = bodyOverride ?? defaultBody

  async function handlePrint() {
    setPrinting(true)
    try {
      const company = getMgCompany('tourism')
      const logoDataUrl = await loadLogoDataUrl()
      const html = buildCertificateHtml({
        studentName: name.trim() || '—',
        roleLabel: effectiveRole.trim() || DEFAULT_ROLE[gender],
        bodyParagraphs: body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
        conclusion: conclusion.trim(),
        place: place.trim() || 'Nosy Komba',
        dateLabel: formatDateEn(dateISO),
        signatoryName: 'Borut Retelj',
        signatoryTitle: 'CEO',
        company: 'Komba Cabana Tourism SARL',
        lodgeName: 'KOMBA CABANA LODGE',
        locationLine: 'NOSY KOMBA · MADAGASCAR',
        logoDataUrl,
      })
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) return
      doc.open()
      doc.write(html)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }, 400)
    } finally {
      setPrinting(false)
    }
  }

  const labelCls = 'text-[11px] uppercase tracking-wide text-white/40'
  const inputCls =
    'rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-[#c59b5b]/50 focus:outline-none'

  return (
    <div className="space-y-5">
      {/* Izbira vrste dokumenta */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode('praksa')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'praksa'
              ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Certifikat o praksi
        </button>
        <button
          onClick={() => setMode('zaposlitev')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'zaposlitev'
              ? 'bg-[#c59b5b]/20 text-[#c59b5b] border border-[#c59b5b]/30'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          Potrdilo o zaposlitvi
        </button>
      </div>

      {/* Glava */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[#c59b5b]" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              {mode === 'praksa' ? 'Certifikat o praksi' : 'Potrdilo o zaposlitvi'}
            </h2>
            <p className="text-xs text-white/40">
              {mode === 'praksa'
                ? 'Potrdilo za študenta o uspešno opravljeni praksi (v angleščini)'
                : 'Certificat de travail ob prekinitvi delovnega razmerja (v francoščini)'}
            </p>
          </div>
        </div>
        <button
          onClick={mode === 'praksa' ? handlePrint : handlePrintTravail}
          disabled={printing || (mode === 'praksa' ? !name.trim() : !tName.trim())}
          className="flex items-center gap-2 rounded-xl bg-[#c59b5b]/20 px-4 py-2 text-sm font-medium text-[#c59b5b] border border-[#c59b5b]/30 transition-colors hover:bg-[#c59b5b]/30 disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          {printing ? 'Pripravljam…' : 'Natisni / izvozi PDF'}
        </button>
      </div>

      {/* Obrazec — praksa */}
      {mode === 'praksa' && (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Izberi zaposlenega</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={selectedStaffId}
              onChange={(e) => handleSelectStaff(e.target.value)}
            >
              <option value="" className="bg-[#143a49]">— ročni vnos —</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#143a49]">
                  {staffDisplayName(s)}
                  {s.staffType ? ` · ${s.staffType}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Ime in priimek študenta</span>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSelectedStaffId('')
              }}
              placeholder="npr. Sandia Himidy"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Spol (za zaimke)</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
            >
              <option value="f">Ženski (she / her)</option>
              <option value="m">Moški (he / his)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Delovno mesto</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={positionKey}
              onChange={(e) => handleSelectPosition(e.target.value)}
            >
              {POSITIONS.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#143a49]">
                  {p.label} · {gender === 'f' ? p.roleF : p.roleM}
                </option>
              ))}
              <option value="" className="bg-[#143a49]">— drugo (ročni vnos) —</option>
            </select>
          </label>

          {!positionKey && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Vloga (ročno, angleško)</span>
              <input
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={DEFAULT_ROLE[gender]}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Področje / oddelek</span>
            <input
              className={inputCls}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="restaurant"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Kraj</span>
            <input
              className={inputCls}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Nosy Komba"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Datum</span>
            <input
              type="date"
              className={`${inputCls} [color-scheme:dark]`}
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className={labelCls}>Besedilo certifikata (samodejno – lahko urediš)</span>
            {bodyOverride !== null && (
              <button
                onClick={() => setBodyOverride(null)}
                className="flex items-center gap-1 text-[11px] text-[#c59b5b] hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Ponastavi na privzeto
              </button>
            )}
          </div>
          <textarea
            className={`${inputCls} min-h-[160px] w-full leading-relaxed`}
            value={body}
            onChange={(e) => setBodyOverride(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-white/30">
            Odstavke loči s prazno vrstico. Ime "Komba Cabana Lodge" se na certifikatu samodejno odebeli.
          </p>
        </div>

        <label className="mt-4 flex flex-col gap-1">
          <span className={labelCls}>Zaključna (krepka) vrstica</span>
          <input
            className={inputCls}
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
          />
        </label>
      </div>
      )}

      {/* Obrazec — potrdilo o zaposlitvi (Certificat de travail) */}
      {mode === 'zaposlitev' && (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Podjetje (na dokumentu)</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={tCompany}
              onChange={(e) => setTCompany(e.target.value as 'sarl' | 'tourism')}
            >
              <option value="sarl" className="bg-[#143a49]">SARL Komba Cabana</option>
              <option value="tourism" className="bg-[#143a49]">SARL Komba Cabana Tourism</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Izberi zaposlenega</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={selectedStaffId}
              onChange={(e) => handleSelectStaffTravail(e.target.value)}
            >
              <option value="" className="bg-[#143a49]">— ročni vnos —</option>
              {activeStaff.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#143a49]">
                  {staffDisplayName(s)}
                  {s.staffType ? ` · ${s.staffType}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Ime in priimek (PRIIMEK Ime)</span>
            <input
              className={inputCls}
              value={tName}
              onChange={(e) => {
                setTName(e.target.value)
                setSelectedStaffId('')
              }}
              placeholder="npr. SOAMANANO Charlesia"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Spol</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={tGender}
              onChange={(e) => setTGender(e.target.value as Gender)}
            >
              <option value="f">Ženski (la nommée)</option>
              <option value="m">Moški (le nommé)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Delovno mesto</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={tPositionKey}
              onChange={(e) => {
                setTPositionKey(e.target.value)
                setTQualiteOverride(null)
              }}
            >
              {POSITIONS.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#143a49]">
                  {p.label} · {tGender === 'f' ? p.roleFrF : p.roleFrM}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Qualité (funkcija, francosko)</span>
            <input
              className={inputCls}
              value={tQualite}
              onChange={(e) => setTQualiteOverride(e.target.value)}
              placeholder="femme de chambre"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Začetek zaposlitve</span>
            <input
              type="date"
              className={`${inputCls} [color-scheme:dark]`}
              value={tStartISO}
              onChange={(e) => setTStartISO(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Konec zaposlitve</span>
            <input
              type="date"
              className={`${inputCls} [color-scheme:dark]`}
              value={tEndISO}
              onChange={(e) => setTEndISO(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Zadnja klasifikacija</span>
            <input
              className={inputCls}
              value={tClassification}
              onChange={(e) => setTClassification(e.target.value)}
              placeholder="npr. M1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Indice</span>
            <input
              className={inputCls}
              value={tIndice}
              onChange={(e) => setTIndice(e.target.value)}
              placeholder="npr. 1733"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Kraj</span>
            <input
              className={inputCls}
              value={tPlace}
              onChange={(e) => setTPlace(e.target.value)}
              placeholder="Nosy-Be"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Datum izdaje</span>
            <input
              type="date"
              className={`${inputCls} [color-scheme:dark]`}
              value={tDateISO}
              onChange={(e) => setTDateISO(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-[11px] text-white/30">
          Predstavnik: Monsieur RETELJ Borut · podpis: Le Gérant. Klasifikacija in indice sta prazna,
          če ju ne izpolniš (vrstica se skrije).
        </p>
      </div>
      )}

      <p className="text-xs text-white/40">
        Podpis:{' '}
        <span className="text-white/70">
          {mode === 'praksa'
            ? 'Borut Retelj · CEO · Komba Cabana Tourism SARL'
            : 'Monsieur RETELJ Borut · Le Gérant · SARL Komba Cabana'}
        </span>
      </p>
    </div>
  )
}
