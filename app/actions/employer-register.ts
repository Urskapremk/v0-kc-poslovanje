'use server'

// =====================================================================
// Registre d'employeur — strežniške akcije.
// Vse mutacije zapišejo NESPREMENLJIVO revizijsko sled (spec §8).
// Fizično brisanje NI implementirano nikjer (spec §1, §6): namesto tega
// rectify / annuler / clôturer / marquer sorti + mehki umik dokumentov.
// Podatki delavca se povežejo s staff_members (brez podvajanja vira);
// register hrani snapshot, ker je uradna knjiga.
// =====================================================================

import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  computeChecksum,
  type AuditActionType,
  type AuditRow,
  type DashboardStats,
  type DuplicateMatch,
  type EmployerDocument,
  type Establishment,
  type ExportRecord,
  type Inspection,
  type RegisterEntry,
  type RegisterRole,
  type RelationRow,
  type SpecialCategory,
  type SpecialRegisterRow,
  type EmployerDeclaration,
  type DeclarationStatus,
  type PeriodicReport,
  type PeriodicStatus,
} from '@/lib/employer-register'

const DEFAULT_ESTABLISHMENT_ID = 'est-komba-cabana-lodge'

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function currentUserLabel(): Promise<string> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.email || session?.user?.name || 'inconnu'
  } catch {
    return 'inconnu'
  }
}

// --- Revizijska sled: SAMO vstavljanje ---
async function writeAudit(opts: {
  establishmentId?: string | null
  registerPart?: string | null
  registerEntryId?: string | null
  employeeId?: string | null
  actionType: AuditActionType
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
  reason?: string | null
  userRole?: RegisterRole | null
  documentReference?: string | null
}) {
  const createdBy = await currentUserLabel()
  await db.execute(sql`
    INSERT INTO employer_register_audit_log
      (id, "companyId", "establishmentId", "registerPart", "registerEntryId", "employeeId",
       "actionType", "fieldName", "oldValue", "newValue", reason, "createdBy", "userRole", "documentReference")
    VALUES (
      ${uid('aud')}, 'tourism', ${opts.establishmentId ?? null}, ${opts.registerPart ?? null},
      ${opts.registerEntryId ?? null}, ${opts.employeeId ?? null}, ${opts.actionType},
      ${opts.fieldName ?? null}, ${opts.oldValue ?? null}, ${opts.newValue ?? null},
      ${opts.reason ?? null}, ${createdBy}, ${opts.userRole ?? null}, ${opts.documentReference ?? null}
    )
  `)
}

// ------------------------------------------------------------------ Obrati

export async function getEstablishments(): Promise<Establishment[]> {
  const res = await db.execute(sql`SELECT * FROM employer_establishments ORDER BY name`)
  return res.rows.map(mapEstablishment)
}

export async function ensureDefaultEstablishment(): Promise<Establishment> {
  const res = await db.execute(sql`SELECT * FROM employer_establishments WHERE id = ${DEFAULT_ESTABLISHMENT_ID}`)
  if (res.rows[0]) return mapEstablishment(res.rows[0])
  await db.execute(sql`
    INSERT INTO employer_establishments (id, "companyId", name, "raisonSociale")
    VALUES (${DEFAULT_ESTABLISHMENT_ID}, 'tourism', 'Komba Cabana Lodge', 'KOMBA CABANA TOURISM SARL')
    ON CONFLICT (id) DO NOTHING
  `)
  const again = await db.execute(sql`SELECT * FROM employer_establishments WHERE id = ${DEFAULT_ESTABLISHMENT_ID}`)
  return mapEstablishment(again.rows[0])
}

export async function updateEstablishment(
  id: string,
  data: Partial<Omit<Establishment, 'id' | 'companyId'>>,
  role: RegisterRole,
) {
  const allowed: (keyof typeof data)[] = [
    'name', 'nomCommercial', 'raisonSociale', 'nif', 'stat', 'rcs', 'adresseSiege',
    'adresseEtablissement', 'activitePrincipale', 'responsableLegal', 'responsableEtablissement',
    'inspectionOffice', 'registerNumber', 'openingDate', 'logoPathname',
  ]
  for (const key of allowed) {
    const value = data[key]
    if (value === undefined) continue
    await db.execute(sql`UPDATE employer_establishments SET ${sql.identifier(key as string)} = ${(value as string | null) ?? null} WHERE id = ${id}`)
  }
  await writeAudit({ establishmentId: id, actionType: 'ESTABLISHMENT_UPDATE', userRole: role })
  revalidatePath('/statistika')
}

function mapEstablishment(r: Record<string, unknown>): Establishment {
  return {
    id: r.id as string,
    companyId: (r.companyId as string) ?? 'tourism',
    name: (r.name as string) ?? '',
    nomCommercial: (r.nomCommercial as string | null) ?? null,
    raisonSociale: (r.raisonSociale as string | null) ?? null,
    nif: (r.nif as string | null) ?? null,
    stat: (r.stat as string | null) ?? null,
    rcs: (r.rcs as string | null) ?? null,
    adresseSiege: (r.adresseSiege as string | null) ?? null,
    adresseEtablissement: (r.adresseEtablissement as string | null) ?? null,
    activitePrincipale: (r.activitePrincipale as string | null) ?? null,
    responsableLegal: (r.responsableLegal as string | null) ?? null,
    responsableEtablissement: (r.responsableEtablissement as string | null) ?? null,
    inspectionOffice: (r.inspectionOffice as string | null) ?? null,
    registerNumber: (r.registerNumber as string | null) ?? null,
    openingDate: (r.openingDate as string | null) ?? null,
    logoPathname: (r.logoPathname as string | null) ?? null,
  }
}

// ------------------------------------------------------------ 1ère Partie

export async function getRegisterEntries(
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<RegisterEntry[]> {
  const res = await db.execute(sql`
    SELECT * FROM employer_register_entries
    WHERE "establishmentId" = ${establishmentId}
    ORDER BY "ordreNumber" ASC
  `)
  return res.rows.map(mapEntry)
}

// Kandidati iz kadrovske evidence, ki še niso vpisani v register.
export async function getUnregisteredStaff(establishmentId = DEFAULT_ESTABLISHMENT_ID) {
  const res = await db.execute(sql`
    SELECT s.* FROM staff_members s
    WHERE s."isRegularEmployee" = true
      AND NOT EXISTS (
        SELECT 1 FROM employer_register_entries e
        WHERE e."employeeId" = s.id AND e."establishmentId" = ${establishmentId}
      )
    ORDER BY COALESCE(s."lastName", s."staffName")
  `)
  return res.rows.map((s) => ({
    id: s.id as string,
    staffName: (s.staffName as string | null) ?? '',
    firstName: (s.firstName as string | null) ?? '',
    lastName: (s.lastName as string | null) ?? '',
    gender: (s.gender as string | null) ?? '',
    dateOfBirth: (s.dateOfBirth as string | null) ?? null,
    placeOfBirth: (s.placeOfBirth as string | null) ?? '',
    nationality: (s.nationality as string | null) ?? '',
    documentNumber: (s.documentNumber as string | null) ?? '',
    cnapsNumber: (s.cnapsNumber as string | null) ?? '',
    ominoNumber: (s.ominoNumber as string | null) ?? '',
    ostieNumber: (s.ostieNumber as string | null) ?? '',
    address: (s.address as string | null) ?? '',
    phone: (s.phone as string | null) ?? '',
    startDate: (s.startDate as string | null) ?? null,
    monthlySalary: s.monthlySalary != null ? Number(s.monthlySalary) : null,
    wageCategory: (s.wageCategory as string | null) ?? '',
  }))
}

// Preverjanje dvojnikov (spec §6) — pred vpisom.
export async function checkWorkerDuplicates(
  input: { cin?: string; passeport?: string; nom?: string; prenoms?: string; dateNaissance?: string; cnaps?: string },
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<DuplicateMatch[]> {
  const res = await db.execute(sql`
    SELECT id, "ordreNumber", nom, prenoms, cin, passeport, cnaps, "dateNaissance"
    FROM employer_register_entries WHERE "establishmentId" = ${establishmentId}
  `)
  const norm = (v?: string | null) => (v || '').trim().toLowerCase()
  const matches: DuplicateMatch[] = []
  for (const r of res.rows) {
    const base = { entryId: r.id as string, ordreNumber: Number(r.ordreNumber), nom: r.nom as string | null, prenoms: r.prenoms as string | null }
    if (input.cin && norm(r.cin as string) && norm(r.cin as string) === norm(input.cin)) matches.push({ ...base, reason: 'cin' })
    else if (input.passeport && norm(r.passeport as string) && norm(r.passeport as string) === norm(input.passeport)) matches.push({ ...base, reason: 'passeport' })
    else if (input.cnaps && norm(r.cnaps as string) && norm(r.cnaps as string) === norm(input.cnaps)) matches.push({ ...base, reason: 'cnaps' })
    else if (
      input.nom && input.prenoms && input.dateNaissance &&
      norm(r.nom as string) === norm(input.nom) &&
      norm(r.prenoms as string) === norm(input.prenoms) &&
      (r.dateNaissance as string | null) === input.dateNaissance
    ) matches.push({ ...base, reason: 'nomNaissance' })
  }
  return matches
}

export async function inscribeWorker(
  data: Partial<RegisterEntry> & { role: RegisterRole },
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<{ id: string; ordreNumber: number }> {
  const { role } = data
  const maxRes = await db.execute(sql`
    SELECT COALESCE(MAX("ordreNumber"), 0) AS maxord FROM employer_register_entries WHERE "establishmentId" = ${establishmentId}
  `)
  const ordreNumber = Number(maxRes.rows[0]?.maxord ?? 0) + 1
  const id = uid('emp')
  await db.execute(sql`
    INSERT INTO employer_register_entries (
      id, "companyId", "establishmentId", "ordreNumber", "matriculeInterne", "dateInscription",
      "dateEntree", "employeeId", nom, prenoms, sexe, "dateNaissance", "lieuNaissance", nationalite,
      adresse, "situationMatrimoniale", "typePiece", cin, passeport, "dateDelivrance", "lieuDelivrance",
      "dateExpiration", "lieuRecrutement", "carteTravail", cnaps, "organismeMedical", telephone,
      "contactUrgence", observations, status, "createdBy"
    ) VALUES (
      ${id}, 'tourism', ${establishmentId}, ${ordreNumber}, ${data.matriculeInterne ?? null},
      ${data.dateInscription ?? null}, ${data.dateEntree ?? null}, ${data.employeeId ?? null},
      ${data.nom ?? null}, ${data.prenoms ?? null}, ${data.sexe ?? null}, ${data.dateNaissance ?? null},
      ${data.lieuNaissance ?? null}, ${data.nationalite ?? null}, ${data.adresse ?? null},
      ${data.situationMatrimoniale ?? null}, ${data.typePiece ?? null}, ${data.cin ?? null},
      ${data.passeport ?? null}, ${data.dateDelivrance ?? null}, ${data.lieuDelivrance ?? null},
      ${data.dateExpiration ?? null}, ${data.lieuRecrutement ?? null}, ${data.carteTravail ?? null},
      ${data.cnaps ?? null}, ${data.organismeMedical ?? null}, ${data.telephone ?? null},
      ${data.contactUrgence ?? null}, ${data.observations ?? null}, 'active', ${await currentUserLabel()}
    )
  `)
  await writeAudit({
    establishmentId, registerPart: '1', registerEntryId: id, employeeId: data.employeeId ?? null,
    actionType: 'CREATE', newValue: `N° ${ordreNumber} — ${data.nom ?? ''} ${data.prenoms ?? ''}`.trim(), userRole: role,
  })
  revalidatePath('/statistika')
  return { id, ordreNumber }
}

// Popravek polj (spec §6): shrani staro/novo vrednost + obvezen razlog v revizijo.
export async function rectifyEntry(
  entryId: string,
  changes: Record<string, string | null>,
  reason: string,
  role: RegisterRole,
) {
  if (!reason || !reason.trim()) throw new Error('Motif de rectification obligatoire')
  const cur = await db.execute(sql`SELECT * FROM employer_register_entries WHERE id = ${entryId}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Entrée introuvable')
  const editable = new Set([
    'matriculeInterne', 'dateInscription', 'dateEntree', 'nom', 'prenoms', 'sexe', 'dateNaissance',
    'lieuNaissance', 'nationalite', 'adresse', 'situationMatrimoniale', 'typePiece', 'cin', 'passeport',
    'dateDelivrance', 'lieuDelivrance', 'dateExpiration', 'lieuRecrutement', 'carteTravail', 'cnaps',
    'organismeMedical', 'telephone', 'contactUrgence', 'observations',
  ])
  for (const [field, value] of Object.entries(changes)) {
    if (!editable.has(field)) continue
    const oldVal = before[field] == null ? null : String(before[field])
    if ((oldVal ?? '') === (value ?? '')) continue
    await db.execute(sql`UPDATE employer_register_entries SET ${sql.identifier(field)} = ${value ?? null} WHERE id = ${entryId}`)
    await writeAudit({
      establishmentId: before.establishmentId as string, registerPart: '1', registerEntryId: entryId,
      employeeId: (before.employeeId as string | null) ?? null, actionType: 'RECTIFICATION',
      fieldName: field, oldValue: oldVal, newValue: value ?? null, reason, userRole: role,
    })
  }
  revalidatePath('/statistika')
}

// Sprememba statusa (annuler / clôturer / marquer sorti) — brez fizičnega brisanja.
export async function changeEntryStatus(
  entryId: string,
  status: 'cancelled' | 'closed' | 'sorti',
  reason: string,
  role: RegisterRole,
) {
  if (!reason || !reason.trim()) throw new Error('Motif obligatoire')
  const cur = await db.execute(sql`SELECT * FROM employer_register_entries WHERE id = ${entryId}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Entrée introuvable')
  await db.execute(sql`UPDATE employer_register_entries SET status = ${status}, "statusReason" = ${reason} WHERE id = ${entryId}`)
  const action: AuditActionType = status === 'cancelled' ? 'CANCELLATION' : status === 'closed' ? 'CLOSURE' : 'EXIT'
  await writeAudit({
    establishmentId: before.establishmentId as string, registerPart: '1', registerEntryId: entryId,
    employeeId: (before.employeeId as string | null) ?? null, actionType: action,
    oldValue: before.status as string, newValue: status, reason, userRole: role,
  })
  revalidatePath('/statistika')
}

function mapEntry(r: Record<string, unknown>): RegisterEntry {
  return {
    id: r.id as string,
    companyId: (r.companyId as string) ?? 'tourism',
    establishmentId: r.establishmentId as string,
    ordreNumber: Number(r.ordreNumber),
    matriculeInterne: (r.matriculeInterne as string | null) ?? null,
    dateInscription: (r.dateInscription as string | null) ?? null,
    dateEntree: (r.dateEntree as string | null) ?? null,
    employeeId: (r.employeeId as string | null) ?? null,
    nom: (r.nom as string | null) ?? null,
    prenoms: (r.prenoms as string | null) ?? null,
    sexe: (r.sexe as string | null) ?? null,
    dateNaissance: (r.dateNaissance as string | null) ?? null,
    lieuNaissance: (r.lieuNaissance as string | null) ?? null,
    nationalite: (r.nationalite as string | null) ?? null,
    adresse: (r.adresse as string | null) ?? null,
    situationMatrimoniale: (r.situationMatrimoniale as string | null) ?? null,
    typePiece: (r.typePiece as string | null) ?? null,
    cin: (r.cin as string | null) ?? null,
    passeport: (r.passeport as string | null) ?? null,
    dateDelivrance: (r.dateDelivrance as string | null) ?? null,
    lieuDelivrance: (r.lieuDelivrance as string | null) ?? null,
    dateExpiration: (r.dateExpiration as string | null) ?? null,
    lieuRecrutement: (r.lieuRecrutement as string | null) ?? null,
    carteTravail: (r.carteTravail as string | null) ?? null,
    cnaps: (r.cnaps as string | null) ?? null,
    organismeMedical: (r.organismeMedical as string | null) ?? null,
    telephone: (r.telephone as string | null) ?? null,
    contactUrgence: (r.contactUrgence as string | null) ?? null,
    observations: (r.observations as string | null) ?? null,
    status: (r.status as RegisterEntry['status']) ?? 'active',
    statusReason: (r.statusReason as string | null) ?? null,
    extraFields: (r.extraFields as Record<string, unknown>) ?? {},
    hiddenFields: (r.hiddenFields as string[]) ?? [],
    createdAt: r.createdAt as string,
    createdBy: (r.createdBy as string | null) ?? null,
  }
}

// ------------------------------------------------------------ 2ème Partie

export async function getRelations(entryId: string): Promise<RelationRow[]> {
  const res = await db.execute(sql`
    SELECT * FROM employer_relations WHERE "entryId" = ${entryId} ORDER BY COALESCE("effectiveDate", "createdAt"::date) ASC, "createdAt" ASC
  `)
  return res.rows.map((r) => ({ ...(r as Record<string, unknown>), id: r.id as string, entryId: r.entryId as string, rowType: (r.rowType as string) ?? 'initial', effectiveDate: (r.effectiveDate as string | null) ?? null, extraFields: (r.extraFields as Record<string, unknown>) ?? {}, createdAt: r.createdAt as string, createdBy: (r.createdBy as string | null) ?? null }))
}

// Vsaka sprememba delovnega razmerja = NOVA vrstica (append-only, spec §4).
export async function addRelationRow(
  entryId: string,
  data: Record<string, string | number | boolean | null>,
  role: RegisterRole,
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<string> {
  const id = uid('rel')
  const editable = new Set([
    'rowType', 'effectiveDate', 'poste', 'fonction', 'departement', 'categorie', 'classification',
    'typeContrat', 'numContrat', 'dateDebut', 'dateFinPrevue', 'periodeEssai', 'dateConfirmation',
    'lieuTravail', 'dureeHebdo', 'horaire', 'rotation', 'travailNuit', 'travailDimanche', 'travailFeries',
    'salaireBase', 'modePaiement', 'periodicite', 'indemnites', 'avantages', 'primes', 'dateEffetSalaire',
    'changementPoste', 'changementCategorie', 'changementSalaire', 'affectation', 'suspension', 'conge',
    'absenceProlongee', 'sanction', 'accidentTravail', 'maladieProfessionnelle', 'dateSortie', 'motifSortie',
  ])
  // Osnovni insert, nato posamezni update (izognemo dinamičnemu VALUES seznamu).
  await db.execute(sql`INSERT INTO employer_relations (id, "entryId", "companyId", "establishmentId", "createdBy") VALUES (${id}, ${entryId}, 'tourism', ${establishmentId}, ${await currentUserLabel()})`)
  for (const [key, value] of Object.entries(data)) {
    if (!editable.has(key) || value === undefined) continue
    await db.execute(sql`UPDATE employer_relations SET ${sql.identifier(key)} = ${value} WHERE id = ${id}`)
  }
  await writeAudit({ establishmentId, registerPart: '2', registerEntryId: entryId, actionType: 'RELATION_ADD', newValue: (data.rowType as string) ?? 'initial', userRole: role })
  revalidatePath('/statistika')
  return id
}

// ------------------------------------------------------------ 3ème Partie

export async function getInspections(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<Inspection[]> {
  const res = await db.execute(sql`SELECT * FROM employer_inspections WHERE "establishmentId" = ${establishmentId} ORDER BY "visitDate" DESC, "createdAt" DESC`)
  return res.rows.map(mapInspection)
}

export async function addInspection(
  data: Partial<Inspection> & { role: RegisterRole },
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<string> {
  if (!data.visitDate) throw new Error('Date de visite obligatoire')
  if (!data.inspecteurNom?.trim()) throw new Error('Nom de l’inspecteur obligatoire')
  if (!data.infractions?.trim()) throw new Error('Infractions relevées obligatoires')
  if (!data.mesuresPrescrites?.trim()) throw new Error('Mesures prescrites obligatoires')
  if (!data.delaiExecution) throw new Error('Délai d’exécution obligatoire')
  const id = uid('insp')
  await db.execute(sql`
    INSERT INTO employer_inspections (
      id, "companyId", "establishmentId", "entryId", "visitDate", "inspecteurNom", "inspecteurFonction",
      "inspecteurService", "typeVisite", "objetVisite", constatations, infractions, "mesuresPrescrites",
      "baseLegale", "delaiExecution", "observationsEmployeur", "suiteDonnee", "dateRegularisation",
      "referenceProcesVerbal", "miseEnDemeure", status, "createdBy"
    ) VALUES (
      ${id}, 'tourism', ${establishmentId}, ${data.entryId ?? null}, ${data.visitDate}, ${data.inspecteurNom},
      ${data.inspecteurFonction ?? null}, ${data.inspecteurService ?? null}, ${data.typeVisite ?? null},
      ${data.objetVisite ?? null}, ${data.constatations ?? null}, ${data.infractions}, ${data.mesuresPrescrites},
      ${data.baseLegale ?? null}, ${data.delaiExecution}, ${data.observationsEmployeur ?? null},
      ${data.suiteDonnee ?? null}, ${data.dateRegularisation ?? null}, ${data.referenceProcesVerbal ?? null},
      ${data.miseEnDemeure ?? false}, ${data.status ?? 'a_traiter'}, ${await currentUserLabel()}
    )
  `)
  await writeAudit({ establishmentId, registerPart: '3', registerEntryId: data.entryId ?? null, actionType: 'INSPECTION_ADD', newValue: `Visite ${data.visitDate} — ${data.inspecteurNom}`, userRole: data.role })
  revalidatePath('/statistika')
  return id
}

export async function updateInspection(
  id: string,
  data: Partial<Inspection>,
  role: RegisterRole,
) {
  const cur = await db.execute(sql`SELECT * FROM employer_inspections WHERE id = ${id}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Contrôle introuvable')
  if (before.locked === true) throw new Error('Contrôle verrouillé — modification interdite')
  const editable = new Set([
    'inspecteurFonction', 'inspecteurService', 'typeVisite', 'objetVisite', 'constatations',
    'baseLegale', 'observationsEmployeur', 'suiteDonnee', 'dateRegularisation', 'referenceProcesVerbal',
    'miseEnDemeure', 'status',
  ])
  for (const [field, value] of Object.entries(data)) {
    if (!editable.has(field) || value === undefined) continue
    await db.execute(sql`UPDATE employer_inspections SET ${sql.identifier(field)} = ${value as string | boolean | null} WHERE id = ${id}`)
  }
  await writeAudit({ establishmentId: before.establishmentId as string, registerPart: '3', actionType: 'INSPECTION_UPDATE', reason: (data.status as string | undefined) ? `Statut: ${data.status}` : null, userRole: role })
  revalidatePath('/statistika')
}

// Zaklep podpisanega inšpekcijskega vpisa (delodajalec ga nato ne more urejati, spec §5).
export async function lockInspection(id: string, role: RegisterRole) {
  const cur = await db.execute(sql`SELECT "establishmentId" FROM employer_inspections WHERE id = ${id}`)
  await db.execute(sql`UPDATE employer_inspections SET locked = true WHERE id = ${id}`)
  await writeAudit({ establishmentId: (cur.rows[0]?.establishmentId as string) ?? null, registerPart: '3', actionType: 'INSPECTION_LOCK', userRole: role })
  revalidatePath('/statistika')
}

function mapInspection(r: Record<string, unknown>): Inspection {
  return {
    id: r.id as string,
    companyId: (r.companyId as string) ?? 'tourism',
    establishmentId: r.establishmentId as string,
    entryId: (r.entryId as string | null) ?? null,
    visitDate: r.visitDate as string,
    inspecteurNom: r.inspecteurNom as string,
    inspecteurFonction: (r.inspecteurFonction as string | null) ?? null,
    inspecteurService: (r.inspecteurService as string | null) ?? null,
    typeVisite: (r.typeVisite as string | null) ?? null,
    objetVisite: (r.objetVisite as string | null) ?? null,
    constatations: (r.constatations as string | null) ?? null,
    infractions: (r.infractions as string) ?? '',
    mesuresPrescrites: (r.mesuresPrescrites as string) ?? '',
    baseLegale: (r.baseLegale as string | null) ?? null,
    delaiExecution: r.delaiExecution as string,
    observationsEmployeur: (r.observationsEmployeur as string | null) ?? null,
    suiteDonnee: (r.suiteDonnee as string | null) ?? null,
    dateRegularisation: (r.dateRegularisation as string | null) ?? null,
    referenceProcesVerbal: (r.referenceProcesVerbal as string | null) ?? null,
    miseEnDemeure: r.miseEnDemeure === true,
    status: (r.status as Inspection['status']) ?? 'a_traiter',
    locked: r.locked === true,
    extraFields: (r.extraFields as Record<string, unknown>) ?? {},
    createdAt: r.createdAt as string,
    createdBy: (r.createdBy as string | null) ?? null,
  }
}

// ------------------------------------------------------------ Dokumenti

export async function getDocuments(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<EmployerDocument[]> {
  const res = await db.execute(sql`SELECT * FROM employer_documents WHERE "establishmentId" = ${establishmentId} AND "removedAt" IS NULL ORDER BY "uploadedAt" DESC`)
  return res.rows.map(mapDocument)
}

export async function addDocument(
  data: { entryId?: string | null; inspectionId?: string | null; employeeId?: string | null; docType?: string; fileName?: string; pathname: string },
  role: RegisterRole,
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<string> {
  const id = uid('doc')
  await db.execute(sql`
    INSERT INTO employer_documents (id, "companyId", "establishmentId", "entryId", "inspectionId", "employeeId", "docType", "fileName", pathname, "uploadedBy")
    VALUES (${id}, 'tourism', ${establishmentId}, ${data.entryId ?? null}, ${data.inspectionId ?? null}, ${data.employeeId ?? null}, ${data.docType ?? null}, ${data.fileName ?? null}, ${data.pathname}, ${await currentUserLabel()})
  `)
  await writeAudit({ establishmentId, registerEntryId: data.entryId ?? null, actionType: 'DOCUMENT_UPLOAD', newValue: data.fileName ?? data.pathname, documentReference: data.pathname, userRole: role })
  revalidatePath('/statistika')
  return id
}

// Mehki umik (dokument ostane arhiviran, ni fizičnega brisanja).
export async function removeDocument(id: string, role: RegisterRole) {
  const cur = await db.execute(sql`SELECT * FROM employer_documents WHERE id = ${id}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) return
  await db.execute(sql`UPDATE employer_documents SET "removedAt" = now(), "removedBy" = ${await currentUserLabel()} WHERE id = ${id}`)
  await writeAudit({ establishmentId: before.establishmentId as string, registerEntryId: (before.entryId as string | null) ?? null, actionType: 'DOCUMENT_REMOVE', oldValue: (before.fileName as string | null) ?? (before.pathname as string), documentReference: before.pathname as string, userRole: role })
  revalidatePath('/statistika')
}

function mapDocument(r: Record<string, unknown>): EmployerDocument {
  return {
    id: r.id as string,
    entryId: (r.entryId as string | null) ?? null,
    inspectionId: (r.inspectionId as string | null) ?? null,
    employeeId: (r.employeeId as string | null) ?? null,
    docType: (r.docType as string | null) ?? null,
    fileName: (r.fileName as string | null) ?? null,
    pathname: r.pathname as string,
    uploadedAt: r.uploadedAt as string,
    uploadedBy: (r.uploadedBy as string | null) ?? null,
    removedAt: (r.removedAt as string | null) ?? null,
    removedBy: (r.removedBy as string | null) ?? null,
  }
}

// ------------------------------------------------------------ Revizijska sled

export async function getAuditLog(
  opts: { entryId?: string; establishmentId?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  const est = opts.establishmentId ?? DEFAULT_ESTABLISHMENT_ID
  const limit = opts.limit ?? 500
  const res = opts.entryId
    ? await db.execute(sql`SELECT * FROM employer_register_audit_log WHERE "registerEntryId" = ${opts.entryId} ORDER BY "createdAt" DESC LIMIT ${limit}`)
    : await db.execute(sql`SELECT * FROM employer_register_audit_log WHERE "establishmentId" = ${est} ORDER BY "createdAt" DESC LIMIT ${limit}`)
  return res.rows.map((r) => ({
    id: r.id as string,
    registerPart: (r.registerPart as string | null) ?? null,
    registerEntryId: (r.registerEntryId as string | null) ?? null,
    employeeId: (r.employeeId as string | null) ?? null,
    actionType: r.actionType as AuditActionType,
    fieldName: (r.fieldName as string | null) ?? null,
    oldValue: (r.oldValue as string | null) ?? null,
    newValue: (r.newValue as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    createdAt: r.createdAt as string,
    createdBy: (r.createdBy as string | null) ?? null,
    userRole: (r.userRole as string | null) ?? null,
    documentReference: (r.documentReference as string | null) ?? null,
  }))
}

// ------------------------------------------------------------ Nadzorna plošča

export async function getDashboardStats(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<DashboardStats> {
  const entries = await getRegisterEntries(establishmentId)
  const inspections = await getInspections(establishmentId)
  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 86400000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const todayISO = iso(today)
  const in30ISO = iso(in30)

  const active = entries.filter((e) => e.status === 'active')
  const incomplete = active.filter((e) => !e.nom || !e.prenoms || !e.dateNaissance || !e.dateEntree)
  const missingCin = active.filter((e) => !e.cin && e.typePiece !== 'Passeport')
  const missingCnaps = active.filter((e) => !e.cnaps)

  // Pogodbe pred iztekom: iz 2ème Partie (najnovejši dateFinPrevue na aktivnem vpisu).
  let contractsExpiringSoon = 0
  for (const e of active) {
    const rels = await db.execute(sql`SELECT "dateFinPrevue" FROM employer_relations WHERE "entryId" = ${e.id} AND "dateFinPrevue" IS NOT NULL ORDER BY "effectiveDate" DESC NULLS LAST, "createdAt" DESC LIMIT 1`)
    const fin = rels.rows[0]?.dateFinPrevue as string | undefined
    if (fin && fin >= todayISO && fin <= in30ISO) contractsExpiringSoon++
  }

  const openMiseEnDemeure = inspections.filter((i) => i.miseEnDemeure && i.status !== 'cloture' && i.status !== 'verifie').length
  const upcomingDeadlines = inspections.filter((i) => i.delaiExecution >= todayISO && i.delaiExecution <= in30ISO && i.status !== 'cloture' && i.status !== 'regularise' && i.status !== 'verifie').length
  const overdueMeasures = inspections.filter((i) => i.delaiExecution < todayISO && i.status !== 'cloture' && i.status !== 'regularise' && i.status !== 'verifie').length

  return {
    total: entries.length,
    active: active.length,
    sorti: entries.filter((e) => e.status === 'sorti').length,
    incomplete: incomplete.length,
    missingCin: missingCin.length,
    missingCnaps: missingCnaps.length,
    contractsExpiringSoon,
    inspectionsTotal: inspections.length,
    openMiseEnDemeure,
    upcomingDeadlines,
    overdueMeasures,
  }
}

// ------------------------------------------------------------ Izvozi (zaklep)

export async function getExports(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<ExportRecord[]> {
  const res = await db.execute(sql`SELECT * FROM employer_register_exports WHERE "establishmentId" = ${establishmentId} ORDER BY "createdAt" DESC`)
  return res.rows.map((r) => ({
    id: r.id as string,
    registerPart: r.registerPart as string,
    exportNumber: Number(r.exportNumber),
    version: Number(r.version),
    checksum: (r.checksum as string | null) ?? null,
    pdfPathname: (r.pdfPathname as string | null) ?? null,
    includedEntryIds: (r.includedEntryIds as string[]) ?? [],
    createdAt: r.createdAt as string,
    createdBy: (r.createdBy as string | null) ?? null,
  }))
}

// Ustvari uraden zapis izvoza (verzija + kontrolna vsota). PDF sam se generira v odjemalcu;
// tu shranimo nespremenljiv zapis (spec §12): checksum vsebine + seznam vključenih zapisov.
export async function createOfficialExport(
  registerPart: string,
  contentForChecksum: string,
  includedEntryIds: string[],
  role: RegisterRole,
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<ExportRecord> {
  const maxRes = await db.execute(sql`SELECT COALESCE(MAX("exportNumber"), 0) AS maxn, COALESCE(MAX(version), 0) AS maxv FROM employer_register_exports WHERE "establishmentId" = ${establishmentId} AND "registerPart" = ${registerPart}`)
  const exportNumber = Number(maxRes.rows[0]?.maxn ?? 0) + 1
  const version = Number(maxRes.rows[0]?.maxv ?? 0) + 1
  const checksum = computeChecksum(`${establishmentId}|${registerPart}|${version}|${contentForChecksum}`)
  const id = uid('exp')
  await db.execute(sql`
    INSERT INTO employer_register_exports (id, "companyId", "establishmentId", "registerPart", "exportNumber", version, checksum, "includedEntryIds", "createdBy")
    VALUES (${id}, 'tourism', ${establishmentId}, ${registerPart}, ${exportNumber}, ${version}, ${checksum}, ${JSON.stringify(includedEntryIds)}::jsonb, ${await currentUserLabel()})
  `)
  await writeAudit({ establishmentId, registerPart, actionType: 'EXPORT', newValue: `Export N° ${exportNumber} v${version} — ${checksum}`, documentReference: checksum, userRole: role })
  revalidatePath('/statistika')
  return { id, registerPart, exportNumber, version, checksum, pdfPathname: null, includedEntryIds, createdAt: new Date().toISOString(), createdBy: await currentUserLabel() }
}

// ------------------------------------------------------------ Posebni registri

export async function getSpecialRegisters(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<SpecialRegisterRow[]> {
  const res = await db.execute(sql`SELECT * FROM employer_special_registers WHERE "establishmentId" = ${establishmentId} ORDER BY "createdAt" DESC`)
  return res.rows.map((r) => ({
    id: r.id as string,
    entryId: r.entryId as string,
    category: r.category as SpecialCategory,
    extraFields: (r.extraFields as Record<string, unknown>) ?? {},
    createdAt: r.createdAt as string,
    createdBy: (r.createdBy as string | null) ?? null,
  }))
}

export async function addToSpecialRegister(
  entryId: string,
  category: SpecialCategory,
  extraFields: Record<string, unknown>,
  role: RegisterRole,
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
): Promise<string> {
  const id = uid('spec')
  await db.execute(sql`
    INSERT INTO employer_special_registers (id, "entryId", "companyId", "establishmentId", category, "extraFields", "createdBy")
    VALUES (${id}, ${entryId}, 'tourism', ${establishmentId}, ${category}, ${JSON.stringify(extraFields)}::jsonb, ${await currentUserLabel()})
  `)
  await writeAudit({ establishmentId, registerEntryId: entryId, actionType: 'SPECIAL_REGISTER_ADD', newValue: category, userRole: role })
  revalidatePath('/statistika')
  return id
}

// ============================================================ Déclaration d'établissement
// Snapshot ob izdelavi: podatki obrata se PREPIŠEJO v data JSONB; poznejše
// spremembe obrata NE spreminjajo že izdelane (podpisane/arhivirane) prijave.

function mapDeclaration(r: Record<string, unknown>): EmployerDeclaration {
  return {
    id: r.id as string,
    companyId: (r.companyId as string) ?? 'tourism',
    establishmentId: r.establishmentId as string,
    objet: (r.objet as string | null) ?? null,
    objetPrecisions: (r.objetPrecisions as string | null) ?? null,
    data: (r.data as Record<string, unknown>) ?? {},
    status: (r.status as DeclarationStatus) ?? 'draft',
    hideProvisional: r.hideProvisional === true,
    signedDocPathname: (r.signedDocPathname as string | null) ?? null,
    dateDepot: (r.dateDepot as string | null) ?? null,
    createdBy: (r.createdBy as string | null) ?? null,
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
    signedAt: (r.signedAt as string | null) ?? null,
    depositedAt: (r.depositedAt as string | null) ?? null,
    archivedAt: (r.archivedAt as string | null) ?? null,
  }
}

export async function getDeclarations(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<EmployerDeclaration[]> {
  const res = await db.execute(sql`SELECT * FROM employer_declarations WHERE "establishmentId" = ${establishmentId} ORDER BY "createdAt" DESC`)
  return res.rows.map(mapDeclaration)
}

export async function createDeclaration(role: RegisterRole, establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<EmployerDeclaration> {
  const est = await ensureDefaultEstablishment()
  // Snapshot obstoječih podatkov obrata (spec: podatke prenesi samodejno, brez nove kopije nastavitev).
  const data: Record<string, unknown> = {
    nom: est.name ?? '',
    nomCommercial: est.nomCommercial ?? '',
    raisonSociale: est.raisonSociale ?? '',
    adresseEtablissement: est.adresseEtablissement ?? est.adresseSiege ?? '',
    activitePrincipale: est.activitePrincipale ?? '',
    nomEntrepriseMere: est.raisonSociale ?? '',
    adresseSiegeMere: est.adresseSiege ?? '',
    dateDeclaration: new Date().toISOString().slice(0, 10),
  }
  const id = uid('decl')
  await db.execute(sql`
    INSERT INTO employer_declarations (id, "companyId", "establishmentId", data, status, "createdBy")
    VALUES (${id}, 'tourism', ${establishmentId}, ${JSON.stringify(data)}::jsonb, 'draft', ${await currentUserLabel()})
  `)
  await writeAudit({ establishmentId, actionType: 'DECLARATION_ETABLISSEMENT_CREATED', newValue: 'Brouillon', userRole: role })
  revalidatePath('/statistika')
  const again = await db.execute(sql`SELECT * FROM employer_declarations WHERE id = ${id}`)
  return mapDeclaration(again.rows[0])
}

export async function saveDeclaration(
  id: string,
  patch: { objet?: string | null; objetPrecisions?: string | null; data?: Record<string, unknown>; hideProvisional?: boolean },
  role: RegisterRole,
) {
  const cur = await db.execute(sql`SELECT * FROM employer_declarations WHERE id = ${id}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Déclaration introuvable')
  if ((before.status as string) === 'archived') throw new Error('Déclaration archivée — modification interdite')
  if (patch.objet !== undefined) await db.execute(sql`UPDATE employer_declarations SET objet = ${patch.objet ?? null} WHERE id = ${id}`)
  if (patch.objetPrecisions !== undefined) await db.execute(sql`UPDATE employer_declarations SET "objetPrecisions" = ${patch.objetPrecisions ?? null} WHERE id = ${id}`)
  if (patch.hideProvisional !== undefined) await db.execute(sql`UPDATE employer_declarations SET "hideProvisional" = ${patch.hideProvisional} WHERE id = ${id}`)
  if (patch.data !== undefined) {
    const merged = { ...((before.data as Record<string, unknown>) ?? {}), ...patch.data }
    await db.execute(sql`UPDATE employer_declarations SET data = ${JSON.stringify(merged)}::jsonb WHERE id = ${id}`)
  }
  await db.execute(sql`UPDATE employer_declarations SET "updatedAt" = now() WHERE id = ${id}`)
  await writeAudit({ establishmentId: before.establishmentId as string, actionType: 'DECLARATION_ETABLISSEMENT_UPDATED', userRole: role })
  revalidatePath('/statistika')
}

export async function setDeclarationStatus(id: string, status: DeclarationStatus, role: RegisterRole) {
  const cur = await db.execute(sql`SELECT * FROM employer_declarations WHERE id = ${id}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Déclaration introuvable')
  await db.execute(sql`UPDATE employer_declarations SET status = ${status} WHERE id = ${id}`)
  if (status === 'signed') await db.execute(sql`UPDATE employer_declarations SET "signedAt" = now() WHERE id = ${id}`)
  if (status === 'deposited') await db.execute(sql`UPDATE employer_declarations SET "depositedAt" = now() WHERE id = ${id}`)
  if (status === 'archived') await db.execute(sql`UPDATE employer_declarations SET "archivedAt" = now() WHERE id = ${id}`)
  const action: AuditActionType =
    status === 'signed' ? 'DECLARATION_ETABLISSEMENT_SIGNED'
    : status === 'deposited' ? 'DECLARATION_ETABLISSEMENT_DEPOSITED'
    : 'DECLARATION_ETABLISSEMENT_UPDATED'
  await writeAudit({ establishmentId: before.establishmentId as string, actionType: action, oldValue: before.status as string, newValue: status, reason: status === 'archived' ? 'Archivé' : null, userRole: role })
  revalidatePath('/statistika')
}

// Priloži podpisani dokument prijave: shrani pot na prijavi IN v obstoječi zavihek Documents.
export async function attachDeclarationDocument(
  id: string,
  pathname: string,
  fileName: string,
  role: RegisterRole,
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
) {
  await db.execute(sql`UPDATE employer_declarations SET "signedDocPathname" = ${pathname}, "updatedAt" = now() WHERE id = ${id}`)
  await addDocument({ docType: 'Formulaire signé', fileName, pathname }, role, establishmentId)
  revalidatePath('/statistika')
}

export async function exportDeclaration(id: string, contentForChecksum: string, role: RegisterRole, establishmentId = DEFAULT_ESTABLISHMENT_ID) {
  const rec = await createOfficialExport('declaration', contentForChecksum, [id], role, establishmentId)
  await writeAudit({ establishmentId, actionType: 'DECLARATION_ETABLISSEMENT_EXPORTED', newValue: `Export N° ${rec.exportNumber} v${rec.version} — ${rec.checksum}`, documentReference: rec.checksum, userRole: role })
  return rec
}

// ============================================================ Renseignements périodiques (1. stran)

function mapPeriodic(r: Record<string, unknown>): PeriodicReport {
  return {
    id: r.id as string,
    companyId: (r.companyId as string) ?? 'tourism',
    establishmentId: r.establishmentId as string,
    year: r.year != null ? Number(r.year) : null,
    periode: (r.periode as string | null) ?? null,
    documentNumber: (r.documentNumber as string | null) ?? null,
    dateEnvoi: (r.dateEnvoi as string | null) ?? null,
    status: (r.status as PeriodicStatus) ?? 'draft',
    hideProvisional: r.hideProvisional === true,
    data: (r.data as Record<string, unknown>) ?? {},
    signedDocPathname: (r.signedDocPathname as string | null) ?? null,
    createdBy: (r.createdBy as string | null) ?? null,
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
    signedAt: (r.signedAt as string | null) ?? null,
    sentAt: (r.sentAt as string | null) ?? null,
    archivedAt: (r.archivedAt as string | null) ?? null,
  }
}

export async function getPeriodicReports(establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<PeriodicReport[]> {
  const res = await db.execute(sql`SELECT * FROM employer_periodic_reports WHERE "establishmentId" = ${establishmentId} ORDER BY year DESC NULLS LAST, "createdAt" DESC`)
  return res.rows.map(mapPeriodic)
}

export async function createPeriodicReport(role: RegisterRole, establishmentId = DEFAULT_ESTABLISHMENT_ID): Promise<PeriodicReport> {
  const est = await ensureDefaultEstablishment()
  const year = new Date().getFullYear()
  // Snapshot obstoječih podatkov podjetja + obrata.
  const data: Record<string, unknown> = {
    annee: String(year),
    mereNomRaisonSociale: est.raisonSociale ?? '',
    mereAdresse: est.adresseSiege ?? '',
    mereStat: est.stat ?? '',
    mereNomChef: est.responsableLegal ?? '',
    etabNomDenomination: est.name ?? '',
    etabStat: est.stat ?? '',
    etabNomDirecteur: est.responsableEtablissement ?? est.responsableLegal ?? '',
    etabAdresse: est.adresseEtablissement ?? est.adresseSiege ?? '',
    etabActivitePrincipale: est.activitePrincipale ?? '',
  }
  const id = uid('rp')
  await db.execute(sql`
    INSERT INTO employer_periodic_reports (id, "companyId", "establishmentId", year, data, status, "createdBy")
    VALUES (${id}, 'tourism', ${establishmentId}, ${year}, ${JSON.stringify(data)}::jsonb, 'draft', ${await currentUserLabel()})
  `)
  await writeAudit({ establishmentId, actionType: 'RENSEIGNEMENTS_PERIODIQUES_CREATED', newValue: `Brouillon ${year}`, userRole: role })
  revalidatePath('/statistika')
  const again = await db.execute(sql`SELECT * FROM employer_periodic_reports WHERE id = ${id}`)
  return mapPeriodic(again.rows[0])
}

export async function savePeriodicReport(
  id: string,
  patch: { year?: number | null; periode?: string | null; documentNumber?: string | null; dateEnvoi?: string | null; data?: Record<string, unknown>; hideProvisional?: boolean },
  role: RegisterRole,
) {
  const cur = await db.execute(sql`SELECT * FROM employer_periodic_reports WHERE id = ${id}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Renseignements introuvables')
  if ((before.status as string) === 'archive') throw new Error('Document archivé — modification interdite')
  if (patch.year !== undefined) await db.execute(sql`UPDATE employer_periodic_reports SET year = ${patch.year ?? null} WHERE id = ${id}`)
  if (patch.periode !== undefined) await db.execute(sql`UPDATE employer_periodic_reports SET periode = ${patch.periode ?? null} WHERE id = ${id}`)
  if (patch.documentNumber !== undefined) await db.execute(sql`UPDATE employer_periodic_reports SET "documentNumber" = ${patch.documentNumber ?? null} WHERE id = ${id}`)
  if (patch.dateEnvoi !== undefined) await db.execute(sql`UPDATE employer_periodic_reports SET "dateEnvoi" = ${patch.dateEnvoi ?? null} WHERE id = ${id}`)
  if (patch.hideProvisional !== undefined) await db.execute(sql`UPDATE employer_periodic_reports SET "hideProvisional" = ${patch.hideProvisional} WHERE id = ${id}`)
  if (patch.data !== undefined) {
    const merged = { ...((before.data as Record<string, unknown>) ?? {}), ...patch.data }
    await db.execute(sql`UPDATE employer_periodic_reports SET data = ${JSON.stringify(merged)}::jsonb WHERE id = ${id}`)
  }
  await db.execute(sql`UPDATE employer_periodic_reports SET "updatedAt" = now() WHERE id = ${id}`)
  await writeAudit({ establishmentId: before.establishmentId as string, actionType: 'RENSEIGNEMENTS_PERIODIQUES_UPDATED', userRole: role })
  revalidatePath('/statistika')
}

export async function setPeriodicStatus(id: string, status: PeriodicStatus, role: RegisterRole) {
  const cur = await db.execute(sql`SELECT * FROM employer_periodic_reports WHERE id = ${id}`)
  const before = cur.rows[0] as Record<string, unknown> | undefined
  if (!before) throw new Error('Renseignements introuvables')
  await db.execute(sql`UPDATE employer_periodic_reports SET status = ${status} WHERE id = ${id}`)
  if (status === 'signe') await db.execute(sql`UPDATE employer_periodic_reports SET "signedAt" = now() WHERE id = ${id}`)
  if (status === 'envoye') await db.execute(sql`UPDATE employer_periodic_reports SET "sentAt" = now() WHERE id = ${id}`)
  if (status === 'archive') await db.execute(sql`UPDATE employer_periodic_reports SET "archivedAt" = now() WHERE id = ${id}`)
  const action: AuditActionType =
    status === 'signe' ? 'RENSEIGNEMENTS_PERIODIQUES_SIGNED'
    : status === 'envoye' ? 'RENSEIGNEMENTS_PERIODIQUES_SENT'
    : 'RENSEIGNEMENTS_PERIODIQUES_UPDATED'
  await writeAudit({ establishmentId: before.establishmentId as string, actionType: action, oldValue: before.status as string, newValue: status, reason: status === 'archive' ? 'Archivé' : null, userRole: role })
  revalidatePath('/statistika')
}

export async function attachPeriodicDocument(
  id: string,
  pathname: string,
  fileName: string,
  role: RegisterRole,
  establishmentId = DEFAULT_ESTABLISHMENT_ID,
) {
  await db.execute(sql`UPDATE employer_periodic_reports SET "signedDocPathname" = ${pathname}, "updatedAt" = now() WHERE id = ${id}`)
  await addDocument({ docType: 'Renseignements périodiques', fileName, pathname }, role, establishmentId)
  revalidatePath('/statistika')
}

export async function exportPeriodicReport(id: string, contentForChecksum: string, role: RegisterRole, establishmentId = DEFAULT_ESTABLISHMENT_ID) {
  const rec = await createOfficialExport('renseignements', contentForChecksum, [id], role, establishmentId)
  await writeAudit({ establishmentId, actionType: 'RENSEIGNEMENTS_PERIODIQUES_EXPORTED', newValue: `Export N° ${rec.exportNumber} v${rec.version} — ${rec.checksum}`, documentReference: rec.checksum, userRole: role })
  return rec
}
