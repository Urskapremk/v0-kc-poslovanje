'use client'

import React from 'react'
import { Printer, X, Save, Check } from 'lucide-react'
import { updateReservation } from '@/app/actions/komba'

export interface PoliceFormReservation {
  id?: string
  pax?: number | null
  guestName: string
  secondGuestName?: string | null
  nationality?: string | null
  passport?: string | null
  dateOfBirth?: string | null
  placeOfBirth?: string | null
  fatherName?: string | null
  motherName?: string | null
  profession?: string | null
  domicile?: string | null
  passportDate?: string | null
  passportLieu?: string | null
  venantDe?: string | null
  validiteVisa?: string | null
  allantA?: string | null
  secondNationality?: string | null
  secondPassport?: string | null
  secondDateOfBirth?: string | null
  secondPlaceOfBirth?: string | null
  secondFatherName?: string | null
  secondMotherName?: string | null
  secondProfession?: string | null
  secondDomicile?: string | null
  secondPassportDate?: string | null
  secondPassportLieu?: string | null
  secondVenantDe?: string | null
  secondValiditeVisa?: string | null
  secondAllantA?: string | null
  thirdGuestName?: string | null
  thirdNationality?: string | null
  thirdPassport?: string | null
  thirdDateOfBirth?: string | null
  thirdPlaceOfBirth?: string | null
  thirdFatherName?: string | null
  thirdMotherName?: string | null
  thirdProfession?: string | null
  thirdDomicile?: string | null
  thirdPassportDate?: string | null
  thirdPassportLieu?: string | null
  thirdVenantDe?: string | null
  thirdValiditeVisa?: string | null
  thirdAllantA?: string | null
  fourthGuestName?: string | null
  fourthNationality?: string | null
  fourthPassport?: string | null
  fourthDateOfBirth?: string | null
  fourthPlaceOfBirth?: string | null
  fourthFatherName?: string | null
  fourthMotherName?: string | null
  fourthProfession?: string | null
  fourthDomicile?: string | null
  fourthPassportDate?: string | null
  fourthPassportLieu?: string | null
  fourthVenantDe?: string | null
  fourthValiditeVisa?: string | null
  fourthAllantA?: string | null
  arrival: string
  departure: string
}

// Police Registration Form Modal (shared between main reception and archive)
export function PoliceFormModal({ reservation, isOpen, onClose, onSaved }: {
  reservation: PoliceFormReservation
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}) {
  const [slot, setSlot] = React.useState<'first' | 'second' | 'third' | 'fourth'>('first')
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const [formData, setFormData] = React.useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    lieuNaissance: '',
    pere: '',
    mere: '',
    profession: '',
    domicile: '',
    nationalite: '',
    pieceIdentite: 'Passport',
    passportNo: '',
    passportDate: '',
    passportLieu: '',
    dateArrivee: '',
    venantDe: '',
    validiteVisa: '',
    dateDepart: '',
    aliantA: '',
    modeTransport: 'Avion'
  })

  React.useEffect(() => {
    if (isOpen) {
      // Pick the correct guest's data based on the selected slot (1st/2nd/3rd)
      const pick = (first?: string | null, second?: string | null, third?: string | null, fourth?: string | null) =>
        (slot === 'fourth' ? fourth : slot === 'third' ? third : slot === 'second' ? second : first) || ''
      const guestName = pick(reservation.guestName, reservation.secondGuestName, reservation.thirdGuestName, reservation.fourthGuestName)
      const nameParts = guestName.trim().split(' ')
      setFormData(prev => ({
        ...prev,
        nom: nameParts.slice(1).join(' ') || '',
        prenom: nameParts[0] || '',
        nationalite: pick(reservation.nationality, reservation.secondNationality, reservation.thirdNationality, reservation.fourthNationality),
        passportNo: pick(reservation.passport, reservation.secondPassport, reservation.thirdPassport, reservation.fourthPassport),
        dateNaissance: pick(reservation.dateOfBirth, reservation.secondDateOfBirth, reservation.thirdDateOfBirth, reservation.fourthDateOfBirth),
        lieuNaissance: pick(reservation.placeOfBirth, reservation.secondPlaceOfBirth, reservation.thirdPlaceOfBirth, reservation.fourthPlaceOfBirth),
        pere: pick(reservation.fatherName, reservation.secondFatherName, reservation.thirdFatherName, reservation.fourthFatherName),
        mere: pick(reservation.motherName, reservation.secondMotherName, reservation.thirdMotherName, reservation.fourthMotherName),
        profession: pick(reservation.profession, reservation.secondProfession, reservation.thirdProfession, reservation.fourthProfession),
        domicile: pick(reservation.domicile, reservation.secondDomicile, reservation.thirdDomicile, reservation.fourthDomicile),
        passportDate: pick(reservation.passportDate, reservation.secondPassportDate, reservation.thirdPassportDate, reservation.fourthPassportDate),
        passportLieu: pick(reservation.passportLieu, reservation.secondPassportLieu, reservation.thirdPassportLieu, reservation.fourthPassportLieu),
        venantDe: pick(reservation.venantDe, reservation.secondVenantDe, reservation.thirdVenantDe, reservation.fourthVenantDe),
        validiteVisa: pick(reservation.validiteVisa, reservation.secondValiditeVisa, reservation.thirdValiditeVisa, reservation.fourthValiditeVisa),
        aliantA: pick(reservation.allantA, reservation.secondAllantA, reservation.thirdAllantA, reservation.fourthAllantA),
        dateArrivee: reservation.arrival,
        dateDepart: reservation.departure,
      }))
    }
  }, [isOpen, reservation, slot])

  // Reset to first guest whenever the modal is opened
  React.useEffect(() => {
    if (isOpen) setSlot('first')
  }, [isOpen])

  // Clear the "saved" badge when switching guest or reopening
  React.useEffect(() => {
    setSaveState('idle')
  }, [slot, isOpen])

  // Persist the typed data back to the reservation (first or second guest slot).
  const handleSave = async () => {
    if (!reservation.id) return
    setSaveState('saving')
    const fullName = `${formData.prenom} ${formData.nom}`.trim()
    const payload = slot === 'fourth'
      ? {
          fourthGuestName: fullName,
          fourthNationality: formData.nationalite,
          fourthPassport: formData.passportNo,
          fourthDateOfBirth: formData.dateNaissance,
          fourthPlaceOfBirth: formData.lieuNaissance,
          fourthFatherName: formData.pere,
          fourthMotherName: formData.mere,
          fourthProfession: formData.profession,
          fourthDomicile: formData.domicile,
          fourthPassportDate: formData.passportDate,
          fourthPassportLieu: formData.passportLieu,
          fourthVenantDe: formData.venantDe,
          fourthValiditeVisa: formData.validiteVisa,
          fourthAllantA: formData.aliantA,
        }
      : slot === 'third'
      ? {
          thirdGuestName: fullName,
          thirdNationality: formData.nationalite,
          thirdPassport: formData.passportNo,
          thirdDateOfBirth: formData.dateNaissance,
          thirdPlaceOfBirth: formData.lieuNaissance,
          thirdFatherName: formData.pere,
          thirdMotherName: formData.mere,
          thirdProfession: formData.profession,
          thirdDomicile: formData.domicile,
          thirdPassportDate: formData.passportDate,
          thirdPassportLieu: formData.passportLieu,
          thirdVenantDe: formData.venantDe,
          thirdValiditeVisa: formData.validiteVisa,
          thirdAllantA: formData.aliantA,
        }
      : slot === 'second'
      ? {
          secondGuestName: fullName,
          secondNationality: formData.nationalite,
          secondPassport: formData.passportNo,
          secondDateOfBirth: formData.dateNaissance,
          secondPlaceOfBirth: formData.lieuNaissance,
          secondFatherName: formData.pere,
          secondMotherName: formData.mere,
          secondProfession: formData.profession,
          secondDomicile: formData.domicile,
          secondPassportDate: formData.passportDate,
          secondPassportLieu: formData.passportLieu,
          secondVenantDe: formData.venantDe,
          secondValiditeVisa: formData.validiteVisa,
          secondAllantA: formData.aliantA,
        }
      : {
          guestName: fullName,
          nationality: formData.nationalite,
          passport: formData.passportNo,
          dateOfBirth: formData.dateNaissance,
          placeOfBirth: formData.lieuNaissance,
          fatherName: formData.pere,
          motherName: formData.mere,
          profession: formData.profession,
          domicile: formData.domicile,
          passportDate: formData.passportDate,
          passportLieu: formData.passportLieu,
          venantDe: formData.venantDe,
          validiteVisa: formData.validiteVisa,
          allantA: formData.aliantA,
        }
    try {
      await updateReservation(reservation.id, payload)
      setSaveState('saved')
      onSaved?.()
    } catch {
      setSaveState('idle')
    }
  }

  const printForm = (d: typeof formData) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fiche de Police - ${d.nom} ${d.prenom}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; line-height: 1.3; }
          .form-container { max-width: 180mm; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 3mm; margin-bottom: 4mm; }
          .header-left h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5mm; }
          .header-left p { font-size: 8pt; color: #555; margin-top: 1mm; }
          .header-right { text-align: right; }
          .header-right img { height: 8mm; }
          .form-row { display: flex; gap: 4mm; margin-bottom: 3mm; }
          .form-field { flex: 1; }
          .form-field.col-3 { flex: 0.33; }
          .form-label { font-size: 8pt; color: #333; text-transform: uppercase; letter-spacing: 0.3mm; margin-bottom: 1mm; display: block; }
          .form-value { border-bottom: 1px solid #000; min-height: 6mm; padding: 1mm 0; font-size: 10pt; font-weight: bold; text-transform: uppercase; }
          .transport-options { display: flex; gap: 3mm; margin-top: 1mm; }
          .transport-option { padding: 1.5mm 3mm; border: 1px solid #999; font-size: 9pt; }
          .transport-option.selected { background: #ddd; border-color: #000; font-weight: bold; }
          .signature-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8mm; padding-top: 5mm; border-top: 1px solid #ccc; }
          .signature-line { width: 50mm; border-bottom: 1px solid #000; }
          .signature-label { font-size: 8pt; margin-bottom: 2mm; }
        </style>
      </head>
      <body>
        <div class="form-container">
          <div class="header">
            <div class="header-left">
              <h1>Fiche de Police</h1>
              <p>PRIERE D'ECRIRE TRES LISIBLEMENT / PLEASE WRITE PLAINLY</p>
            </div>
            <div class="header-right">
              <img src="/images/komba-logo.png" alt="Komba Cabana" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Nom / Name</span><div class="form-value">${d.nom}</div></div>
            <div class="form-field"><span class="form-label">Prenom / First name</span><div class="form-value">${d.prenom}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Date de naissance</span><div class="form-value">${d.dateNaissance}</div></div>
            <div class="form-field"><span class="form-label">Lieu de naissance</span><div class="form-value">${d.lieuNaissance}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Pere / Father</span><div class="form-value">${d.pere}</div></div>
            <div class="form-field"><span class="form-label">Mere / Mother</span><div class="form-value">${d.mere}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Profession</span><div class="form-value">${d.profession}</div></div>
            <div class="form-field"><span class="form-label">Domicile habituel</span><div class="form-value">${d.domicile}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Nationalite</span><div class="form-value">${d.nationalite}</div></div>
            <div class="form-field"><span class="form-label">Piece d'identite</span><div class="form-value">${d.pieceIdentite}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field col-3"><span class="form-label">N° document</span><div class="form-value">${d.passportNo}</div></div>
            <div class="form-field col-3"><span class="form-label">Date delivrance</span><div class="form-value">${d.passportDate}</div></div>
            <div class="form-field col-3"><span class="form-label">Lieu delivrance</span><div class="form-value">${d.passportLieu}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Date d'arrivee</span><div class="form-value">${d.dateArrivee}</div></div>
            <div class="form-field"><span class="form-label">Venant de / Coming from</span><div class="form-value">${d.venantDe}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Validite du Visa</span><div class="form-value">${d.validiteVisa || '30 dni / 90 dni'}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field"><span class="form-label">Date de depart</span><div class="form-value">${d.dateDepart}</div></div>
            <div class="form-field"><span class="form-label">Aliant a / Going to</span><div class="form-value">${d.aliantA}</div></div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <span class="form-label">Mode de transport</span>
              <div class="transport-options">
                ${['Avion', 'Voiture', 'Moto', 'Bateau'].map(t => `<span class="transport-option ${d.modeTransport === t ? 'selected' : ''}">${t}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="signature-section">
            <div>Le _______________</div>
            <div style="text-align: right;">
              <div class="signature-label">Signature du responsable</div>
              <div class="signature-line"></div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print() }, 250)
  }

  // Natisni obrazec z vpisanimi podatki gosta
  const handlePrint = () => printForm(formData)

  // Natisni PRAZEN obrazec (za ročno izpolnjevanje, npr. ko gost ni oddal podatkov)
  const handlePrintBlank = () => printForm({
    nom: '', prenom: '', dateNaissance: '', lieuNaissance: '', pere: '', mere: '',
    profession: '', domicile: '', nationalite: '', pieceIdentite: '', passportNo: '',
    passportDate: '', passportLieu: '', dateArrivee: '', venantDe: '', validiteVisa: '',
    dateDepart: '', aliantA: '', modeTransport: '',
  })

  if (!isOpen) return null

  const inputClass = "w-full border-b border-white/20 bg-transparent px-1 py-2 text-sm text-white focus:border-[#7fa8b8] focus:outline-none"
  const labelClass = "block text-[10px] font-medium uppercase tracking-wider text-white/50 mb-0.5"

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 pt-8">
      <div className="relative w-full max-w-lg bg-[#0e1416] rounded-xl border border-white/10 shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-white">Fiche de Police</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Obrazec za policijo</p>
          </div>
          <div className="flex gap-2">
            {reservation.id ? (
              <button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8fae92]/10 text-[#8fae92] hover:bg-[#8fae92]/20 transition-all text-xs font-medium disabled:opacity-50"
              >
                {saveState === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {saveState === 'saving' ? 'Shranjujem…' : saveState === 'saved' ? 'Shranjeno' : 'Shrani'}
              </button>
            ) : null}
            <button
              onClick={handlePrintBlank}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
              title="Natisni prazen obrazec za ročno izpolnjevanje"
            >
              <Printer className="w-3.5 h-3.5" />
              Prazen obrazec
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7fa8b8]/10 text-[#7fa8b8] hover:bg-[#7fa8b8]/20 transition-all text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5" />
              Natisni
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs — one per guest (up to three); shown when 2+ guests or pax indicates it */}
        {reservation.secondGuestName || reservation.thirdGuestName || (reservation.pax ?? 1) >= 2 ? (
          <div className="flex gap-2 px-5 pt-4">
            <button
              type="button"
              onClick={() => setSlot('first')}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                slot === 'first'
                  ? 'border-[#7fa8b8] bg-[#7fa8b8]/10 text-[#7fa8b8]'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              {reservation.guestName || 'Oseba 1'}
            </button>
            <button
              type="button"
              onClick={() => setSlot('second')}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                slot === 'second'
                  ? 'border-[#d9a68f] bg-[#d9a68f]/10 text-[#d9a68f]'
                  : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              {reservation.secondGuestName || 'Oseba 2 (dodaj)'}
            </button>
            {reservation.thirdGuestName || (reservation.pax ?? 1) >= 3 ? (
              <button
                type="button"
                onClick={() => setSlot('third')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  slot === 'third'
                    ? 'border-[#c4e2ee] bg-[#c4e2ee]/10 text-[#c4e2ee]'
                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                {reservation.thirdGuestName || 'Oseba 3 (dodaj)'}
              </button>
            ) : null}
            {reservation.fourthGuestName || (reservation.pax ?? 1) >= 4 ? (
              <button
                type="button"
                onClick={() => setSlot('fourth')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  slot === 'fourth'
                    ? 'border-[#8fae92] bg-[#8fae92]/10 text-[#8fae92]'
                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                {reservation.fourthGuestName || 'Oseba 4 (dodaj)'}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Form Content */}
        <div className="p-5 space-y-4" id="police-form-content">
          {/* Row 1: Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nom / Name</label>
              <input type="text" value={formData.nom} onChange={e => setFormData(p => ({...p, nom: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Prenom / First name</label>
              <input type="text" value={formData.prenom} onChange={e => setFormData(p => ({...p, prenom: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 2: Birth */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date de naissance</label>
              <input type="date" value={formData.dateNaissance} onChange={e => setFormData(p => ({...p, dateNaissance: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Lieu de naissance</label>
              <input type="text" value={formData.lieuNaissance} onChange={e => setFormData(p => ({...p, lieuNaissance: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 3: Parents */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Pere / Father</label>
              <input type="text" value={formData.pere} onChange={e => setFormData(p => ({...p, pere: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mere / Mother</label>
              <input type="text" value={formData.mere} onChange={e => setFormData(p => ({...p, mere: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 4: Profession & Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Profession</label>
              <input type="text" value={formData.profession} onChange={e => setFormData(p => ({...p, profession: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Domicile habituel</label>
              <input type="text" value={formData.domicile} onChange={e => setFormData(p => ({...p, domicile: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 5: Nationality & ID type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nationalite</label>
              <input type="text" value={formData.nationalite} onChange={e => setFormData(p => ({...p, nationalite: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Piece d&apos;identite</label>
              <input type="text" value={formData.pieceIdentite} onChange={e => setFormData(p => ({...p, pieceIdentite: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 6: Passport details */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>N° document</label>
              <input type="text" value={formData.passportNo} onChange={e => setFormData(p => ({...p, passportNo: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Date delivrance</label>
              <input type="date" value={formData.passportDate} onChange={e => setFormData(p => ({...p, passportDate: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Lieu delivrance</label>
              <input type="text" value={formData.passportLieu} onChange={e => setFormData(p => ({...p, passportLieu: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 7: Arrival */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date d&apos;arrivee</label>
              <input type="date" value={formData.dateArrivee} onChange={e => setFormData(p => ({...p, dateArrivee: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Venant de / Coming from</label>
              <input type="text" value={formData.venantDe} onChange={e => setFormData(p => ({...p, venantDe: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 8: Visa */}
          <div>
            <label className={labelClass}>Validite du Visa</label>
            <input type="text" value={formData.validiteVisa} onChange={e => setFormData(p => ({...p, validiteVisa: e.target.value}))} placeholder="30 dni / 90 dni" className={`${inputClass} placeholder:text-white/20`} />
          </div>

          {/* Row 9: Departure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date de depart</label>
              <input type="date" value={formData.dateDepart} onChange={e => setFormData(p => ({...p, dateDepart: e.target.value}))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Aliant a / Going to</label>
              <input type="text" value={formData.aliantA} onChange={e => setFormData(p => ({...p, aliantA: e.target.value}))} className={inputClass} />
            </div>
          </div>

          {/* Row 10: Transport */}
          <div>
            <label className={labelClass}>Mode de transport</label>
            <div className="flex gap-2 mt-2">
              {['Avion', 'Voiture', 'Moto', 'Bateau'].map(t => (
                <button key={t} type="button" onClick={() => setFormData(p => ({...p, modeTransport: t}))}
                  className={`px-3 py-1.5 rounded border text-xs transition-all ${formData.modeTransport === t ? 'border-[#7fa8b8] bg-[#7fa8b8]/10 text-[#7fa8b8]' : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
