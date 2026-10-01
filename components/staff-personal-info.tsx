'use client'

import React, { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, Upload, FileText, Loader2, ExternalLink, IdCard, User, ClipboardPaste } from 'lucide-react'
import { updateStaffPersonalInfo } from '@/app/actions/statistics'
import { COMPANIES, type CompanyId } from '@/lib/payroll'
import { DEFAULT_WAGE_CATEGORIES } from '@/lib/payroll-mg'

interface StaffPersonalInfoProps {
  staffId: string
  nickname: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  placeOfBirth: string
  documentNumber: string
  documentImagePath: string
  company: string
  gender: string
  fatherName: string
  motherName: string
  nationality: string
  cnapsNumber: string
  ominoNumber: string
  ostieNumber: string
  officialSalary: number | string
  wageCategory: string
  numberOfDependents: number
  openingLeaveBalance: number
  address: string
  phone: string
  email: string
  employeePhotoPath: string
  notes: string
  onImageChange: () => void
}

export default function StaffPersonalInfo({
  staffId,
  nickname,
  firstName,
  lastName,
  dateOfBirth,
  placeOfBirth,
  documentNumber,
  documentImagePath,
  company,
  gender,
  fatherName,
  motherName,
  nationality,
  cnapsNumber,
  ominoNumber,
  ostieNumber,
  officialSalary,
  wageCategory,
  numberOfDependents,
  openingLeaveBalance,
  address,
  phone,
  email,
  employeePhotoPath,
  notes,
  onImageChange,
}: StaffPersonalInfoProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePath, setImagePath] = useState(documentImagePath)
  const [photoPath, setPhotoPath] = useState(employeePhotoPath)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  // Tekstovna polja: shrani na onBlur, BREZ refresh (po pravilu iz memorije)
  const saveField = async (field: string, value: string) => {
    await updateStaffPersonalInfo(staffId, { [field]: value })
  }

  const readClipboardImage = async (): Promise<File | null> => {
    if (!navigator.clipboard?.read) {
      alert('Brskalnik ne podpira branja odložišča. Uporabi Naloži sliko.')
      return null
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          return new File([blob], `posnetek-${Date.now()}.${type.split('/')[1] || 'png'}`, { type })
        }
      }
      alert('V odložišču ni slike. Najprej naredi posnetek zaslona.')
    } catch {
      alert('Dostop do odložišča je zavrnjen.')
    }
    return null
  }

  const uploadDocumentFile = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-staff-document', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await updateStaffPersonalInfo(staffId, { documentImagePath: pathname })
      setImagePath(pathname)
      onImageChange()
    } catch (err) {
      console.error('[v0] Document paste upload error:', err)
      alert('Napaka pri nalaganju dokumenta.')
    } finally {
      setUploading(false)
    }
  }

  const uploadPhotoFile = async (file: File) => {
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-staff-document', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await updateStaffPersonalInfo(staffId, { employeePhotoPath: pathname })
      setPhotoPath(pathname)
      onImageChange()
    } catch (err) {
      console.error('[v0] Photo paste upload error:', err)
      alert('Napaka pri nalaganju fotografije.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handlePasteDocument = async () => {
    const file = await readClipboardImage()
    if (file) await uploadDocumentFile(file)
  }

  const handlePastePhoto = async () => {
    const file = await readClipboardImage()
    if (file) await uploadPhotoFile(file)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-staff-document', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await updateStaffPersonalInfo(staffId, { documentImagePath: pathname })
      setImagePath(pathname)
      onImageChange()
    } catch (err) {
      console.error('[v0] Document upload error:', err)
      alert('Napaka pri nalaganju dokumenta.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-staff-document', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { pathname } = await res.json()
      await updateStaffPersonalInfo(staffId, { employeePhotoPath: pathname })
      setPhotoPath(pathname)
      onImageChange()
    } catch (err) {
      console.error('[v0] Photo upload error:', err)
      alert('Napaka pri nalaganju fotografije.')
    } finally {
      setUploadingPhoto(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  const imageSrc = imagePath ? `/api/image?pathname=${encodeURIComponent(imagePath)}` : ''
  const photoSrc = photoPath ? `/api/image?pathname=${encodeURIComponent(photoPath)}` : ''
  const inputClass =
    'w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#7fa8b8]/40 focus:outline-none'
  const labelClass = 'mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40'

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-medium text-white/60 transition-colors hover:text-white"
      >
        <IdCard className="h-4 w-4 text-[#7fa8b8]" />
        Osebni podatki & dokument
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Osebni podatki (po osebnem dokumentu) */}
          <div className="space-y-3 lg:col-span-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Vzdevek (nickname)</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={nickname}
                  placeholder="npr. Flavi"
                  onBlur={(e) => saveField('nickname', e.target.value)}
                />
                <p className="mt-1 text-[11px] text-white/30">
                  Prikazan poleg imena v seznamih. Uradno ime ostane v podatkih zgoraj.
                </p>
              </div>
              <div>
                <label className={labelClass}>Ime</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={firstName}
                  placeholder="Ime"
                  onBlur={(e) => saveField('firstName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Priimek</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={lastName}
                  placeholder="Priimek"
                  onBlur={(e) => saveField('lastName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Datum rojstva</label>
                <input
                  type="date"
                  className={`${inputClass} [color-scheme:dark]`}
                  defaultValue={dateOfBirth ? dateOfBirth.split('T')[0] : ''}
                  onBlur={(e) => saveField('dateOfBirth', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Kraj rojstva</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={placeOfBirth}
                  placeholder="Kraj rojstva"
                  onBlur={(e) => saveField('placeOfBirth', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Številka osebnega dokumenta (CIN)</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={documentNumber}
                  placeholder="Št. osebne izkaznice / CIN"
                  onBlur={(e) => saveField('documentNumber', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Spol</label>
                <select
                  className={`${inputClass} [color-scheme:dark]`}
                  defaultValue={gender || ''}
                  onChange={(e) => saveField('gender', e.target.value)}
                >
                  <option value="" className="bg-[#143a49]">—</option>
                  <option value="M" className="bg-[#143a49]">Moški</option>
                  <option value="Z" className="bg-[#143a49]">Ženska</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Državljanstvo</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={nationality}
                  placeholder="Malgache"
                  onBlur={(e) => saveField('nationality', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Ime očeta</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={fatherName}
                  placeholder="Ime očeta"
                  onBlur={(e) => saveField('fatherName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Ime matere</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={motherName}
                  placeholder="Ime matere"
                  onBlur={(e) => saveField('motherName', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>CNAPS številka</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={cnapsNumber}
                  placeholder="CNAPS št."
                  onBlur={(e) => saveField('cnapsNumber', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>OMINO številka</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={ominoNumber}
                  placeholder="OMINO št."
                  onBlur={(e) => saveField('ominoNumber', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>OSTIE številka</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={ostieNumber}
                  placeholder="OSTIE št."
                  onBlur={(e) => saveField('ostieNumber', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Uradna plača za prispevke (Ar)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className={inputClass}
                  defaultValue={officialSalary ?? ''}
                  placeholder="npr. 300000"
                  onBlur={(e) => saveField('officialSalary', e.target.value)}
                />
                <p className="mt-1 text-[11px] text-white/30">
                  Znesek, prijavljen za CNAPS/OMINO. Realna (izplačana) plača se ureja zgoraj.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Kategorija zaposlenega</label>
                <select
                  className={`${inputClass} [color-scheme:dark]`}
                  defaultValue={wageCategory || ''}
                  onChange={(e) => saveField('wageCategory', e.target.value)}
                >
                  <option value="" className="bg-[#143a49]">— brez kategorije —</option>
                  {DEFAULT_WAGE_CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#143a49]">
                      {c.code} — min. {c.minWage.toLocaleString('fr-FR')} Ar
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-white/30">
                  Poklicna kategorija (določa minimalno plačo). Uporablja se pri obračunu plače.
                </p>
              </div>
              <div>
                <label className={labelClass}>Število vzdrževanih oseb</label>
                <input
                  type="number"
                  min="0"
                  max="6"
                  className={inputClass}
                  defaultValue={numberOfDependents ?? 0}
                  placeholder="0"
                  onBlur={(e) => saveField('numberOfDependents', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Prenos / popravek dopusta (dni)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={inputClass}
                  defaultValue={openingLeaveBalance ?? 0}
                  placeholder="0"
                  onBlur={(e) => saveField('openingLeaveBalance', e.target.value)}
                />
                <p className="mt-1 text-[11px] text-white/30">
                  Prenos iz preteklih let ali ročni popravek (npr. delal, a ni bil pravočasno prijavljen).
                  Prišteje se pridobljenim dnem na plačilni listi.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Naslov</label>
                <input
                  type="text"
                  className={inputClass}
                  defaultValue={address}
                  placeholder="Naslov stalnega prebivališča"
                  onBlur={(e) => saveField('address', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input
                  type="tel"
                  className={inputClass}
                  defaultValue={phone}
                  placeholder="+261 ..."
                  onBlur={(e) => saveField('phone', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  defaultValue={email}
                  placeholder="email@primer.com"
                  onBlur={(e) => saveField('email', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Opombe</label>
                <textarea
                  className={`${inputClass} min-h-[60px] resize-y`}
                  defaultValue={notes}
                  placeholder="Dodatne opombe ..."
                  onBlur={(e) => saveField('notes', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Podjetje (zaposlitev)</label>
                <select
                  className={`${inputClass} [color-scheme:dark]`}
                  defaultValue={company || 'tourism'}
                  onChange={(e) => saveField('company', e.target.value)}
                >
                  {(Object.keys(COMPANIES) as CompanyId[]).map((id) => (
                    <option key={id} value={id} className="bg-[#143a49]">
                      {COMPANIES[id].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Slike: fotografija zaposlenega + osebni dokument */}
          <div className="space-y-4">
            {/* Fotografija zaposlenega */}
            <div>
              <label className={labelClass}>Fotografija zaposlenega</label>
              <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
                {photoSrc ? (
                  <a href={photoSrc} target="_blank" rel="noopener noreferrer" className="group relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoSrc || "/placeholder.svg"} alt="Fotografija zaposlenega" className="h-40 w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <ExternalLink className="h-4 w-4" />
                      Odpri v novem zavihku
                    </div>
                  </a>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/30">
                    <User className="h-8 w-8" />
                    <span className="text-xs">Ni naložene fotografije</span>
                  </div>
                )}
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} />
              <button
                onClick={() => photoRef.current?.click()}
                disabled={uploadingPhoto}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-2 text-xs font-medium text-[#7fa8b8] transition-colors hover:bg-[#7fa8b8]/20 disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Nalaganje...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {photoSrc ? 'Zamenjaj fotografijo' : 'Naloži fotografijo'}
                  </>
                )}
              </button>
              <button
                onClick={handlePastePhoto}
                disabled={uploadingPhoto}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-3 py-2 text-xs font-medium text-[#8fae92] transition-colors hover:bg-[#8fae92]/20 disabled:opacity-50"
              >
                <ClipboardPaste className="h-4 w-4" />
                Prilepi posnetek zaslona
              </button>
            </div>

            {/* Slika osebnega dokumenta */}
            <div>
            <label className={labelClass}>Slika dokumenta</label>
            <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
              {imageSrc ? (
                <a href={imageSrc} target="_blank" rel="noopener noreferrer" className="group relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc || "/placeholder.svg"}
                    alt="Osebni dokument"
                    className="h-40 w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-4 w-4" />
                    Odpri v novem zavihku
                  </div>
                </a>
              ) : (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-white/30">
                  <FileText className="h-8 w-8" />
                  <span className="text-xs">Ni naložene slike</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#7fa8b8]/30 bg-[#7fa8b8]/10 px-3 py-2 text-xs font-medium text-[#7fa8b8] transition-colors hover:bg-[#7fa8b8]/20 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Nalaganje...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {imageSrc ? 'Zamenjaj sliko' : 'Naloži sliko'}
                </>
              )}
            </button>
            <button
              onClick={handlePasteDocument}
              disabled={uploading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#8fae92]/30 bg-[#8fae92]/10 px-3 py-2 text-xs font-medium text-[#8fae92] transition-colors hover:bg-[#8fae92]/20 disabled:opacity-50"
            >
              <ClipboardPaste className="h-4 w-4" />
              Prilepi posnetek zaslona
            </button>
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
