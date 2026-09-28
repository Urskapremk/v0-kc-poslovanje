'use client'

import React, { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Gavel, Printer } from 'lucide-react'
import { getAllStaffMembers } from '@/app/actions/statistics'
import { buildConvocationHtml, buildAvertissementHtml, type AvertissementLevel } from '@/lib/disciplina-doc'

// Pogosti prekrški — francosko (gre na dokument/tisk) + slovenski prevod (samo v vmesniku, za izbiro).
const INFRACTIONS: { fr: string; sl: string }[] = [
  { fr: 'Refus de suivre les consignes de votre supérieur hiérarchique', sl: 'Odklanjanje navodil nadrejenega' },
  { fr: 'Contestation répétée des instructions données par votre responsable pendant le temps de travail', sl: 'Ponavljajoče oporekanje navodilom vodje med delovnim časom' },
  { fr: 'Retards répétés et injustifiés', sl: 'Ponavljajoče in neopravičene zamude' },
  { fr: 'Absences injustifiées', sl: 'Neopravičene odsotnosti' },
  { fr: 'Manque de respect envers la hiérarchie', sl: 'Nespoštovanje nadrejenih' },
  { fr: 'Manque de respect envers les collègues', sl: 'Nespoštovanje sodelavcev' },
  { fr: 'Manque de respect envers les clients', sl: 'Nespoštovanje gostov / strank' },
  { fr: 'Négligence dans l\'exécution des tâches confiées', sl: 'Malomarnost pri opravljanju zaupanih nalog' },
  { fr: 'Non-respect des règles d\'hygiène et de sécurité', sl: 'Nespoštovanje higienskih in varnostnih pravil' },
  { fr: 'Non-respect du règlement intérieur de l\'entreprise', sl: 'Nespoštovanje internih pravil podjetja' },
  { fr: 'Abandon de poste pendant les heures de travail', sl: 'Zapuščanje delovnega mesta med delovnim časom' },
]
const INFRACTIONS_FR = INFRACTIONS.map((i) => i.fr)

const DEFAULT_INTRO_FR =
  'Nous avons constaté un comportement inacceptable de votre part au sein de notre entreprise, ' +
  'notamment un manque de respect envers votre supérieur hiérarchique ainsi que des attitudes ' +
  'répétées de contestation pendant les heures de travail.'

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

// Francoski datum, npr. "3 juillet 2026" (brez vodilne nicle, mali zacetnica).
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
function formatDateFr(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const labelCls = 'text-xs font-medium text-white/50'
const inputCls =
  'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none'

export default function DisciplinaTab() {
  const { data: staff } = useSWR('all-staff-members', getAllStaffMembers)
  const activeStaff = useMemo(() => (staff ?? []).filter((s) => s.active), [staff])
  const staffDisplayName = (s: (typeof activeStaff)[number]) =>
    `${s.lastName || ''} ${s.firstName || ''}`.trim() || s.staffName

  const [docType, setDocType] = useState<'convocation' | 'avertissement'>('convocation')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [company, setCompany] = useState<'sarl' | 'tourism'>('sarl')
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'f' | 'm'>('f')
  const [office, setOffice] = useState('Andrekareka')
  const [objet, setObjet] = useState("Convocation pour l'entretien préalable au licenciement")
  const [interviewISO, setInterviewISO] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [place, setPlace] = useState('Nosy-Be')
  const [dateISO, setDateISO] = useState(todayISO())
  const [printing, setPrinting] = useState(false)

  // Opozorilo (avertissement)
  const [level, setLevel] = useState<AvertissementLevel>('premier')
  const [selectedFaits, setSelectedFaits] = useState<string[]>([INFRACTIONS_FR[0], INFRACTIONS_FR[1]])
  const [customFait, setCustomFait] = useState('')
  const [introText, setIntroText] = useState(DEFAULT_INTRO_FR)

  function toggleFait(f: string) {
    setSelectedFaits((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
  }
  function addCustomFait() {
    const f = customFait.trim()
    if (!f) return
    setSelectedFaits((prev) => (prev.includes(f) ? prev : [...prev, f]))
    setCustomFait('')
  }

  function handleSelectStaff(id: string) {
    setSelectedStaffId(id)
    if (!id) return
    const s = activeStaff.find((m) => m.id === id)
    if (!s) return
    setName(staffDisplayName(s))
    if (s.gender === 'Z') setGender('f')
    else if (s.gender === 'M') setGender('m')
  }

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

  async function handlePrint() {
    setPrinting(true)
    try {
      const logoDataUrl = await loadLogoDataUrl()
      const companyName = company === 'tourism' ? 'KOMBA CABANA TOURISM SARL' : 'KOMBA CABANA SARL'
      let html: string
      if (docType === 'avertissement') {
        html = buildAvertissementHtml({
          companyName,
          employeeName: name.trim() || '—',
          gender,
          level,
          introText: introText.trim() || undefined,
          faits: selectedFaits,
          placeLabel: place.trim() || 'Nosy-Be',
          dateLabel: formatDateFr(dateISO),
          signatoryName: 'Borut RETELJ',
          signatoryRole: 'Gérant',
          lodgeName: 'KOMBA CABANA LODGE',
          locationLine: 'NOSY KOMBA · MADAGASCAR',
          logoDataUrl,
        })
      } else {
        html = buildConvocationHtml({
          companyName,
          officeAddress: office.trim() || 'Andrekareka',
          employeeName: name.trim() || '—',
          gender,
          objet: objet.trim() || undefined,
          interviewDateLabel: interviewISO ? formatDateFr(interviewISO) : undefined,
          interviewTimeLabel: interviewTime.trim() || undefined,
          placeLabel: place.trim() || 'Nosy-Be',
          dateLabel: formatDateFr(dateISO),
          signatoryName: 'Borut Retelj',
          signatoryCivility: 'Monsieur',
          lodgeName: 'KOMBA CABANA LODGE',
          locationLine: 'NOSY KOMBA · MADAGASCAR',
          logoDataUrl,
        })
      }
      printHtmlDoc(html)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Glava */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-[#c59b5b]" />
          <div>
            <h2 className="text-lg font-semibold text-white">Disciplinski ukrepi</h2>
            <p className="text-xs text-white/40">
              {docType === 'avertissement'
                ? 'Opozorilo (avertissement) — prvo, drugo ali tretje · dokument v francoščini'
                : 'Poziv delavca na zagovor (entretien préalable) — dokument v francoščini'}
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          disabled={printing || !name.trim()}
          className="flex items-center gap-2 rounded-xl bg-[#c59b5b]/20 px-4 py-2 text-sm font-medium text-[#c59b5b] border border-[#c59b5b]/30 transition-colors hover:bg-[#c59b5b]/30 disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          {printing ? 'Pripravljam…' : 'Natisni / izvozi PDF'}
        </button>
      </div>

      {/* Obrazec */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Vrsta dokumenta</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={docType}
              onChange={(e) => setDocType(e.target.value as 'convocation' | 'avertissement')}
            >
              <option value="convocation" className="bg-[#143a49]">Poziv na zagovor (Convocation)</option>
              <option value="avertissement" className="bg-[#143a49]">Opozorilo (Avertissement)</option>
            </select>
          </label>

          {docType === 'avertissement' && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelCls}>Stopnja opozorila</span>
              <select
                className={`${inputCls} [color-scheme:dark]`}
                value={level}
                onChange={(e) => setLevel(e.target.value as AvertissementLevel)}
              >
                <option value="premier" className="bg-[#143a49]">Prvo opozorilo (Premier avertissement)</option>
                <option value="deuxieme" className="bg-[#143a49]">Drugo opozorilo (Deuxième avertissement)</option>
                <option value="troisieme" className="bg-[#143a49]">Tretje opozorilo (Troisième et dernier avertissement)</option>
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>Podjetje (na dokumentu)</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={company}
              onChange={(e) => setCompany(e.target.value as 'sarl' | 'tourism')}
            >
              <option value="sarl" className="bg-[#143a49]">Komba Cabana SARL</option>
              <option value="tourism" className="bg-[#143a49]">Komba Cabana Tourism SARL</option>
            </select>
          </label>

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
            <span className={labelCls}>Ime in priimek (PRIIMEK Ime)</span>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSelectedStaffId('')
              }}
              placeholder="npr. Rasoamiandrina Virginie"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Spol</span>
            <select
              className={`${inputCls} [color-scheme:dark]`}
              value={gender}
              onChange={(e) => setGender(e.target.value as 'f' | 'm')}
            >
              <option value="f">Ženski (Madame)</option>
              <option value="m">Moški (Monsieur)</option>
            </select>
          </label>

          {docType === 'convocation' && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Naslov pisarne</span>
              <input
                className={inputCls}
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                placeholder="Andrekareka"
              />
            </label>
          )}

          {docType === 'convocation' && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelCls}>Predmet (Objet)</span>
              <input
                className={inputCls}
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
              />
            </label>
          )}

          {docType === 'convocation' && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Datum zagovora (neobvezno)</span>
              <input
                type="date"
                className={`${inputCls} [color-scheme:dark]`}
                value={interviewISO}
                onChange={(e) => setInterviewISO(e.target.value)}
              />
            </label>
          )}

          {docType === 'convocation' && (
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Ura zagovora (neobvezno)</span>
              <input
                className={inputCls}
                value={interviewTime}
                onChange={(e) => setInterviewTime(e.target.value)}
                placeholder="npr. 10h00"
              />
            </label>
          )}

          {docType === 'avertissement' && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelCls}>Vrsta prekrška (izberi enega ali več · na tisku samo francosko)</span>
              <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                {INFRACTIONS.map((item) => (
                  <label key={item.fr} className="flex items-start gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[#c59b5b]"
                      checked={selectedFaits.includes(item.fr)}
                      onChange={() => toggleFait(item.fr)}
                    />
                    <span className="flex flex-col">
                      <span className="text-white/85">{item.sl}</span>
                      <span className="text-[11px] italic text-white/40">{item.fr}</span>
                    </span>
                  </label>
                ))}
                {selectedFaits.filter((f) => !INFRACTIONS_FR.includes(f)).map((f) => (
                  <label key={f} className="flex items-start gap-2 text-sm text-[#c59b5b]">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[#c59b5b]"
                      checked
                      onChange={() => toggleFait(f)}
                    />
                    <span>{f}</span>
                  </label>
                ))}
                <div className="mt-1 flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={customFait}
                    onChange={(e) => setCustomFait(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        addCustomFait()
                      }
                    }}
                    placeholder="Dodaj svoj prekršek (v francoščini)…"
                  />
                  <button
                    type="button"
                    onClick={addCustomFait}
                    className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                  >
                    Dodaj
                  </button>
                </div>
              </div>
            </div>
          )}

          {docType === 'avertissement' && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelCls}>Uvodni odstavek (opis vedenja)</span>
              <textarea
                className={`${inputCls} min-h-[90px] resize-y`}
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Kraj</span>
            <input
              className={inputCls}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Nosy-Be"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>Datum dopisa</span>
            <input
              type="date"
              className={`${inputCls} [color-scheme:dark]`}
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-3 text-[11px] text-white/30">
          {docType === 'avertissement'
            ? 'Izberi stopnjo (prvo/drugo/tretje) in eno ali več vrst prekrška. Podpisnik: Borut RETELJ · Gérant.'
            : 'Če datum/ura zagovora nista izpolnjena, se na dokumentu izpišejo pikice za ročni vpis. Podpisnik: Monsieur Borut Retelj · Le Gérant.'}
        </p>
      </div>
    </div>
  )
}
