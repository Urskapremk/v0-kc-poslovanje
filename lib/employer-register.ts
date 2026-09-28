// =====================================================================
// Registre d'employeur (uradni register delodajalca – Madagaskar)
// Cisti tipi, konstante in FR oznake polj. BREZ 'use server'.
//
// Vodilo (spec §15): to NI dokoncna graficna kopija obrazcev. Struktura
// mora dopuscati dodajanje/skrivanje/preimenovanje polj brez izgube
// podatkov (zato extraFields/hiddenFields JSONB na zapisih), izvozi pa
// nosijo oznako MODELE PROVISOIRE dokler postavitve ne uskladimo po
// fotografijah originala.
// =====================================================================

// --- Vloge (spec §7). Zdaj: PIN + izbira vloge, beleži se v revizijsko sled. ---
export type RegisterRole = 'admin' | 'rh' | 'comptable' | 'inspection'

export const REGISTER_ROLES: { id: RegisterRole; label: string; description: string; labelSl: string; descriptionSl: string }[] = [
  { id: 'admin', label: 'Administrateur', description: 'Acces complet', labelSl: 'Administrator', descriptionSl: 'Popoln dostop' },
  { id: 'rh', label: 'Ressources humaines', description: 'Saisie et gestion du personnel', labelSl: 'Kadrovska služba', descriptionSl: 'Vnos in upravljanje osebja' },
  { id: 'comptable', label: 'Comptable', description: 'Consultation paie et contrats', labelSl: 'Računovodstvo', descriptionSl: 'Pregled plač in pogodb' },
  { id: 'inspection', label: 'Inspection (lecture seule)', description: 'Consultation uniquement', labelSl: 'Inšpekcija (samo branje)', descriptionSl: 'Samo pregledovanje' },
]

export function isReadOnlyRole(role: RegisterRole | null | undefined): boolean {
  return role === 'inspection'
}

// --- Deli registra (spec §2–§5) ---
export type RegisterPart = '1' | '2' | '3'

export const REGISTER_PARTS: { id: RegisterPart; label: string; short: string; labelSl: string }[] = [
  { id: '1', label: '1ère Partie — Identité et chronologie', short: '1ère Partie', labelSl: '1. del — Identiteta in kronologija' },
  { id: '2', label: '2ème Partie — Relation de travail', short: '2ème Partie', labelSl: '2. del — Delovno razmerje' },
  { id: '3', label: '3ème Partie — Contrôle de l’inspection', short: '3ème Partie', labelSl: '3. del — Inšpekcijski nadzor' },
]

// --- Tipi dejanj v revizijski sledi (spec §8) ---
export type AuditActionType =
  | 'CREATE'
  | 'RECTIFICATION'
  | 'STATUS_CHANGE'
  | 'CANCELLATION'
  | 'CLOSURE'
  | 'EXIT'
  | 'RELATION_ADD'
  | 'INSPECTION_ADD'
  | 'INSPECTION_UPDATE'
  | 'INSPECTION_LOCK'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_REMOVE'
  | 'EXPORT'
  | 'ESTABLISHMENT_UPDATE'
  | 'SPECIAL_REGISTER_ADD'
  | 'DECLARATION_ETABLISSEMENT_CREATED'
  | 'DECLARATION_ETABLISSEMENT_UPDATED'
  | 'DECLARATION_ETABLISSEMENT_EXPORTED'
  | 'DECLARATION_ETABLISSEMENT_SIGNED'
  | 'DECLARATION_ETABLISSEMENT_DEPOSITED'
  | 'RENSEIGNEMENTS_PERIODIQUES_CREATED'
  | 'RENSEIGNEMENTS_PERIODIQUES_UPDATED'
  | 'RENSEIGNEMENTS_PERIODIQUES_EXPORTED'
  | 'RENSEIGNEMENTS_PERIODIQUES_SIGNED'
  | 'RENSEIGNEMENTS_PERIODIQUES_SENT'

export const AUDIT_ACTION_LABELS: Record<AuditActionType, string> = {
  CREATE: 'Inscription',
  RECTIFICATION: 'Rectification',
  STATUS_CHANGE: 'Changement de statut',
  CANCELLATION: 'Annulation',
  CLOSURE: 'Clôture',
  EXIT: 'Sortie',
  RELATION_ADD: 'Ajout relation de travail',
  INSPECTION_ADD: 'Ajout contrôle',
  INSPECTION_UPDATE: 'Modification contrôle',
  INSPECTION_LOCK: 'Verrouillage contrôle',
  DOCUMENT_UPLOAD: 'Ajout de document',
  DOCUMENT_REMOVE: 'Retrait de document',
  EXPORT: 'Export officiel',
  ESTABLISHMENT_UPDATE: 'Modification établissement',
  SPECIAL_REGISTER_ADD: 'Ajout registre spécial',
  DECLARATION_ETABLISSEMENT_CREATED: 'Déclaration d’établissement — création',
  DECLARATION_ETABLISSEMENT_UPDATED: 'Déclaration d’établissement — modification',
  DECLARATION_ETABLISSEMENT_EXPORTED: 'Déclaration d’établissement — export',
  DECLARATION_ETABLISSEMENT_SIGNED: 'Déclaration d’établissement — signée',
  DECLARATION_ETABLISSEMENT_DEPOSITED: 'Déclaration d’établissement — déposée',
  RENSEIGNEMENTS_PERIODIQUES_CREATED: 'Renseignements périodiques — création',
  RENSEIGNEMENTS_PERIODIQUES_UPDATED: 'Renseignements périodiques — modification',
  RENSEIGNEMENTS_PERIODIQUES_EXPORTED: 'Renseignements périodiques — export',
  RENSEIGNEMENTS_PERIODIQUES_SIGNED: 'Renseignements périodiques — signés',
  RENSEIGNEMENTS_PERIODIQUES_SENT: 'Renseignements périodiques — envoyés',
}

// Slovenski prevodi (samo za razumevanje v vmesniku)
export const AUDIT_ACTION_LABELS_SL: Record<AuditActionType, string> = {
  CREATE: 'Vpis',
  RECTIFICATION: 'Popravek',
  STATUS_CHANGE: 'Sprememba statusa',
  CANCELLATION: 'Razveljavitev',
  CLOSURE: 'Zaključek',
  EXIT: 'Odhod',
  RELATION_ADD: 'Dodano delovno razmerje',
  INSPECTION_ADD: 'Dodan nadzor',
  INSPECTION_UPDATE: 'Sprememba nadzora',
  INSPECTION_LOCK: 'Zaklep nadzora',
  DOCUMENT_UPLOAD: 'Dodan dokument',
  DOCUMENT_REMOVE: 'Umik dokumenta',
  EXPORT: 'Uradni izvoz',
  ESTABLISHMENT_UPDATE: 'Sprememba obrata',
  SPECIAL_REGISTER_ADD: 'Dodan poseben register',
  DECLARATION_ETABLISSEMENT_CREATED: 'Prijava obrata — nastala',
  DECLARATION_ETABLISSEMENT_UPDATED: 'Prijava obrata — spremenjena',
  DECLARATION_ETABLISSEMENT_EXPORTED: 'Prijava obrata — izvožena',
  DECLARATION_ETABLISSEMENT_SIGNED: 'Prijava obrata — podpisana',
  DECLARATION_ETABLISSEMENT_DEPOSITED: 'Prijava obrata — vložena',
  RENSEIGNEMENTS_PERIODIQUES_CREATED: 'Periodični podatki — nastali',
  RENSEIGNEMENTS_PERIODIQUES_UPDATED: 'Periodični podatki — spremenjeni',
  RENSEIGNEMENTS_PERIODIQUES_EXPORTED: 'Periodični podatki — izvoženi',
  RENSEIGNEMENTS_PERIODIQUES_SIGNED: 'Periodični podatki — podpisani',
  RENSEIGNEMENTS_PERIODIQUES_SENT: 'Periodični podatki — poslani',
}

// --- Statusi vpisa (1ère Partie) ---
export type EntryStatus = 'active' | 'cancelled' | 'closed' | 'sorti'

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  active: 'Actif',
  cancelled: 'Annulé',
  closed: 'Clôturé',
  sorti: 'Sorti',
}

export const ENTRY_STATUS_LABELS_SL: Record<EntryStatus, string> = {
  active: 'Aktiven',
  cancelled: 'Razveljavljen',
  closed: 'Zaključen',
  sorti: 'Odšel',
}

// --- Statusi inšpekcije (spec §5 / §13) ---
export type InspectionStatus = 'a_traiter' | 'en_cours' | 'regularise' | 'verifie' | 'cloture'

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  regularise: 'Régularisé',
  verifie: 'Vérifié',
  cloture: 'Clôturé',
}

export const INSPECTION_STATUS_LABELS_SL: Record<InspectionStatus, string> = {
  a_traiter: 'Za obravnavo',
  en_cours: 'V teku',
  regularise: 'Urejeno',
  verifie: 'Preverjeno',
  cloture: 'Zaključeno',
}

// --- Posebne kategorije registrov (spec §14) ---
export type SpecialCategory =
  | 'journalier'
  | 'essai'
  | 'apprenti'
  | 'deplace'
  | 'migrant'
  | 'interimaire'
  | 'tempsPartiel'
  | 'domicile'
  | 'saisonnier'
  | 'mineur'

export const SPECIAL_CATEGORIES: { id: SpecialCategory; label: string; labelSl: string }[] = [
  { id: 'journalier', label: 'Travailleurs journaliers / occasionnels', labelSl: 'Dnevni / priložnostni delavci' },
  { id: 'essai', label: 'Travailleurs en période d’essai', labelSl: 'Delavci na poskusni dobi' },
  { id: 'apprenti', label: 'Apprentis / stagiaires', labelSl: 'Vajenci / pripravniki' },
  { id: 'deplace', label: 'Travailleurs déplacés / détachés', labelSl: 'Premeščeni / napoteni delavci' },
  { id: 'migrant', label: 'Travailleurs étrangers / migrants', labelSl: 'Tuji delavci / migranti' },
  { id: 'interimaire', label: 'Travailleurs intérimaires', labelSl: 'Delavci prek agencije' },
  { id: 'tempsPartiel', label: 'Travailleurs à temps partiel', labelSl: 'Delavci s krajšim delovnim časom' },
  { id: 'domicile', label: 'Travailleurs à domicile', labelSl: 'Delo na domu' },
  { id: 'saisonnier', label: 'Travailleurs saisonniers', labelSl: 'Sezonski delavci' },
  { id: 'mineur', label: 'Travailleurs mineurs (autorisation requise)', labelSl: 'Mladoletni delavci (potrebno dovoljenje)' },
]

// --- Definicija polja (za dinamicno skrivanje/preimenovanje in izpis) ---
export type FieldType = 'text' | 'date' | 'number' | 'textarea' | 'boolean' | 'select'
export type FieldDef = {
  key: string
  label: string      // FR oznaka (privzeta, uradni izraz)
  labelSl?: string   // SL prevod (samo za razumevanje v vmesniku)
  type: FieldType
  options?: string[] // za select
  group?: string     // razdelitev v UI/izpisu (FR)
  groupSl?: string   // SL prevod skupine
}

// Prevodi imen skupin (FR -> SL) za vmesnik.
export const GROUP_LABELS_SL: Record<string, string> = {
  'Chronologie': 'Kronologija',
  'Identité': 'Identiteta',
  'Pièce d’identité': 'Osebni dokument',
  'Administratif': 'Upravni podatki',
  'Général': 'Splošno',
  'Emploi': 'Zaposlitev',
  'Contrat': 'Pogodba',
  'Conditions': 'Delovni pogoji',
  'Rémunération': 'Plačilo',
  'Évolution': 'Spremembe med zaposlitvijo',
  'Sortie': 'Odhod',
  'Visite': 'Obisk',
  'Contrôle': 'Nadzor',
  'Suivi': 'Spremljanje',
  'Autres': 'Drugo',
  'Objet': 'Predmet',
  'Établissement': 'Obrat',
  'Dates': 'Datumi',
  'Entreprise / maison mère': 'Matično podjetje',
  'Signature': 'Podpis',
  'Document': 'Dokument',
  'Entreprise mère': 'Matično podjetje',
  'Établissement enquêté': 'Anketirani obrat',
}

// 1ère Partie — identiteta in kronologija (spec §3)
export const PART1_FIELDS: FieldDef[] = [
  { key: 'matriculeInterne', label: 'Matricule interne', labelSl: 'Interna matična številka', type: 'text', group: 'Chronologie' },
  { key: 'dateInscription', label: 'Date d’inscription au registre', labelSl: 'Datum vpisa v register', type: 'date', group: 'Chronologie' },
  { key: 'dateEntree', label: 'Date d’entrée en service', labelSl: 'Datum nastopa dela', type: 'date', group: 'Chronologie' },
  { key: 'nom', label: 'Nom', labelSl: 'Priimek', type: 'text', group: 'Identité' },
  { key: 'prenoms', label: 'Prénoms', labelSl: 'Ime(na)', type: 'text', group: 'Identité' },
  { key: 'sexe', label: 'Sexe', labelSl: 'Spol', type: 'select', options: ['M', 'F'], group: 'Identité' },
  { key: 'dateNaissance', label: 'Date de naissance', labelSl: 'Datum rojstva', type: 'date', group: 'Identité' },
  { key: 'lieuNaissance', label: 'Lieu de naissance', labelSl: 'Kraj rojstva', type: 'text', group: 'Identité' },
  { key: 'nationalite', label: 'Nationalité', labelSl: 'Državljanstvo', type: 'text', group: 'Identité' },
  { key: 'situationMatrimoniale', label: 'Situation matrimoniale', labelSl: 'Zakonski stan', type: 'text', group: 'Identité' },
  { key: 'adresse', label: 'Adresse / domicile', labelSl: 'Naslov / stalno prebivališče', type: 'text', group: 'Identité' },
  { key: 'telephone', label: 'Téléphone', labelSl: 'Telefon', type: 'text', group: 'Identité' },
  { key: 'contactUrgence', label: 'Personne à contacter (urgence)', labelSl: 'Kontakt za nujne primere', type: 'text', group: 'Identité' },
  { key: 'typePiece', label: 'Type de pièce d’identité', labelSl: 'Vrsta osebnega dokumenta', type: 'select', options: ['CIN', 'Passeport', 'Autre'], group: 'Pièce d’identité' },
  { key: 'cin', label: 'Numéro CIN', labelSl: 'Številka osebne izkaznice (CIN)', type: 'text', group: 'Pièce d’identité' },
  { key: 'passeport', label: 'Numéro de passeport', labelSl: 'Številka potnega lista', type: 'text', group: 'Pièce d’identité' },
  { key: 'dateDelivrance', label: 'Date de délivrance', labelSl: 'Datum izdaje', type: 'date', group: 'Pièce d’identité' },
  { key: 'lieuDelivrance', label: 'Lieu de délivrance', labelSl: 'Kraj izdaje', type: 'text', group: 'Pièce d’identité' },
  { key: 'dateExpiration', label: 'Date d’expiration', labelSl: 'Datum veljavnosti', type: 'date', group: 'Pièce d’identité' },
  { key: 'lieuRecrutement', label: 'Lieu de recrutement', labelSl: 'Kraj zaposlitve', type: 'text', group: 'Administratif' },
  { key: 'carteTravail', label: 'Carte de travail (étranger)', labelSl: 'Delovno dovoljenje (tujec)', type: 'text', group: 'Administratif' },
  { key: 'cnaps', label: 'Numéro CNAPS', labelSl: 'Številka CNAPS (soc. zavarovanje)', type: 'text', group: 'Administratif' },
  { key: 'organismeMedical', label: 'Organisme médical (OSTIE/SMIE)', labelSl: 'Zdravstvena ustanova (OSTIE/SMIE)', type: 'text', group: 'Administratif' },
  { key: 'observations', label: 'Observations', labelSl: 'Opombe', type: 'textarea', group: 'Administratif' },
]

// 2ème Partie — delovno razmerje (spec §4)
export const PART2_FIELDS: FieldDef[] = [
  { key: 'effectiveDate', label: 'Date d’effet', labelSl: 'Datum učinka', type: 'date', group: 'Général' },
  { key: 'poste', label: 'Poste occupé', labelSl: 'Delovno mesto', type: 'text', group: 'Emploi' },
  { key: 'fonction', label: 'Fonction', labelSl: 'Funkcija', type: 'text', group: 'Emploi' },
  { key: 'departement', label: 'Département / service', labelSl: 'Oddelek / služba', type: 'text', group: 'Emploi' },
  { key: 'categorie', label: 'Catégorie professionnelle', labelSl: 'Poklicna kategorija', type: 'text', group: 'Emploi' },
  { key: 'classification', label: 'Classification / indice', labelSl: 'Razvrstitev / plačni razred', type: 'text', group: 'Emploi' },
  { key: 'typeContrat', label: 'Type de contrat', labelSl: 'Vrsta pogodbe', type: 'select', options: ['CDI', 'CDD', 'Essai', 'Apprentissage', 'Saisonnier', 'Intérim'], group: 'Contrat' },
  { key: 'numContrat', label: 'Référence du contrat', labelSl: 'Referenca pogodbe', type: 'text', group: 'Contrat' },
  { key: 'dateDebut', label: 'Date de début', labelSl: 'Datum začetka', type: 'date', group: 'Contrat' },
  { key: 'dateFinPrevue', label: 'Date de fin prévue (CDD)', labelSl: 'Predvideni datum konca (določen čas)', type: 'date', group: 'Contrat' },
  { key: 'periodeEssai', label: 'Période d’essai', labelSl: 'Poskusna doba', type: 'text', group: 'Contrat' },
  { key: 'dateConfirmation', label: 'Date de confirmation', labelSl: 'Datum potrditve', type: 'date', group: 'Contrat' },
  { key: 'lieuTravail', label: 'Lieu de travail', labelSl: 'Kraj dela', type: 'text', group: 'Conditions' },
  { key: 'dureeHebdo', label: 'Durée hebdomadaire', labelSl: 'Tedenski delovni čas', type: 'text', group: 'Conditions' },
  { key: 'horaire', label: 'Horaire de travail', labelSl: 'Delovni urnik', type: 'text', group: 'Conditions' },
  { key: 'rotation', label: 'Rotation / équipe', labelSl: 'Izmena / ekipa', type: 'text', group: 'Conditions' },
  { key: 'travailNuit', label: 'Travail de nuit', labelSl: 'Nočno delo', type: 'boolean', group: 'Conditions' },
  { key: 'travailDimanche', label: 'Travail le dimanche', labelSl: 'Delo ob nedeljah', type: 'boolean', group: 'Conditions' },
  { key: 'travailFeries', label: 'Travail les jours fériés', labelSl: 'Delo ob praznikih', type: 'boolean', group: 'Conditions' },
  { key: 'salaireBase', label: 'Salaire de base (Ar)', labelSl: 'Osnovna plača (Ar)', type: 'number', group: 'Rémunération' },
  { key: 'modePaiement', label: 'Mode de paiement', labelSl: 'Način plačila', type: 'text', group: 'Rémunération' },
  { key: 'periodicite', label: 'Périodicité', labelSl: 'Pogostost izplačila', type: 'text', group: 'Rémunération' },
  { key: 'indemnites', label: 'Indemnités', labelSl: 'Nadomestila', type: 'textarea', group: 'Rémunération' },
  { key: 'avantages', label: 'Avantages en nature', labelSl: 'Ugodnosti v naravi', type: 'textarea', group: 'Rémunération' },
  { key: 'primes', label: 'Primes', labelSl: 'Dodatki / premije', type: 'textarea', group: 'Rémunération' },
  { key: 'dateEffetSalaire', label: 'Date d’effet du salaire', labelSl: 'Datum učinka plače', type: 'date', group: 'Rémunération' },
  { key: 'affectation', label: 'Affectation / mutation', labelSl: 'Razporeditev / premestitev', type: 'textarea', group: 'Évolution' },
  { key: 'suspension', label: 'Suspension', labelSl: 'Suspenz', type: 'textarea', group: 'Évolution' },
  { key: 'conge', label: 'Congés', labelSl: 'Dopusti', type: 'textarea', group: 'Évolution' },
  { key: 'absenceProlongee', label: 'Absence prolongée', labelSl: 'Daljša odsotnost', type: 'textarea', group: 'Évolution' },
  { key: 'sanction', label: 'Sanction disciplinaire', labelSl: 'Disciplinski ukrep', type: 'textarea', group: 'Évolution' },
  { key: 'accidentTravail', label: 'Accident du travail', labelSl: 'Nesreča pri delu', type: 'textarea', group: 'Évolution' },
  { key: 'maladieProfessionnelle', label: 'Maladie professionnelle', labelSl: 'Poklicna bolezen', type: 'textarea', group: 'Évolution' },
  { key: 'dateSortie', label: 'Date de sortie', labelSl: 'Datum odhoda', type: 'date', group: 'Sortie' },
  { key: 'motifSortie', label: 'Motif de sortie', labelSl: 'Razlog odhoda', type: 'textarea', group: 'Sortie' },
]

// 3ème Partie — inšpekcija (spec §5)
export const PART3_FIELDS: FieldDef[] = [
  { key: 'visitDate', label: 'Date de la visite', labelSl: 'Datum obiska', type: 'date', group: 'Visite' },
  { key: 'inspecteurNom', label: 'Nom de l’inspecteur', labelSl: 'Ime inšpektorja', type: 'text', group: 'Visite' },
  { key: 'inspecteurFonction', label: 'Fonction', labelSl: 'Funkcija', type: 'text', group: 'Visite' },
  { key: 'inspecteurService', label: 'Service / bureau', labelSl: 'Služba / urad', type: 'text', group: 'Visite' },
  { key: 'typeVisite', label: 'Type de visite', labelSl: 'Vrsta obiska', type: 'text', group: 'Visite' },
  { key: 'objetVisite', label: 'Objet de la visite', labelSl: 'Namen obiska', type: 'text', group: 'Visite' },
  { key: 'constatations', label: 'Constatations', labelSl: 'Ugotovitve', type: 'textarea', group: 'Contrôle' },
  { key: 'infractions', label: 'Infractions relevées', labelSl: 'Ugotovljene kršitve', type: 'textarea', group: 'Contrôle' },
  { key: 'mesuresPrescrites', label: 'Mesures prescrites', labelSl: 'Predpisani ukrepi', type: 'textarea', group: 'Contrôle' },
  { key: 'baseLegale', label: 'Base légale', labelSl: 'Pravna podlaga', type: 'text', group: 'Contrôle' },
  { key: 'delaiExecution', label: 'Délai d’exécution', labelSl: 'Rok za izvedbo', type: 'date', group: 'Suivi' },
  { key: 'observationsEmployeur', label: 'Observations de l’employeur', labelSl: 'Opombe delodajalca', type: 'textarea', group: 'Suivi' },
  { key: 'suiteDonnee', label: 'Suite donnée', labelSl: 'Sprejeti ukrepi / odziv', type: 'textarea', group: 'Suivi' },
  { key: 'dateRegularisation', label: 'Date de régularisation', labelSl: 'Datum ureditve', type: 'date', group: 'Suivi' },
  { key: 'referenceProcesVerbal', label: 'Référence procès-verbal', labelSl: 'Referenca zapisnika', type: 'text', group: 'Suivi' },
]

// Obvezna polja ob vnosu inspekcije (spec §5)
export const PART3_REQUIRED: string[] = ['visitDate', 'inspecteurNom', 'infractions', 'mesuresPrescrites', 'delaiExecution']

// --- Tipi zapisov (za akcije in UI) ---
export type Establishment = {
  id: string
  companyId: string
  name: string
  nomCommercial: string | null
  raisonSociale: string | null
  nif: string | null
  stat: string | null
  rcs: string | null
  adresseSiege: string | null
  adresseEtablissement: string | null
  activitePrincipale: string | null
  responsableLegal: string | null
  responsableEtablissement: string | null
  inspectionOffice: string | null
  registerNumber: string | null
  openingDate: string | null
  logoPathname: string | null
}

export type RegisterEntry = {
  id: string
  companyId: string
  establishmentId: string
  ordreNumber: number
  matriculeInterne: string | null
  dateInscription: string | null
  dateEntree: string | null
  employeeId: string | null
  nom: string | null
  prenoms: string | null
  sexe: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  adresse: string | null
  situationMatrimoniale: string | null
  typePiece: string | null
  cin: string | null
  passeport: string | null
  dateDelivrance: string | null
  lieuDelivrance: string | null
  dateExpiration: string | null
  lieuRecrutement: string | null
  carteTravail: string | null
  cnaps: string | null
  organismeMedical: string | null
  telephone: string | null
  contactUrgence: string | null
  observations: string | null
  status: EntryStatus
  statusReason: string | null
  extraFields: Record<string, unknown>
  hiddenFields: string[]
  createdAt: string
  createdBy: string | null
}

export type RelationRow = {
  id: string
  entryId: string
  rowType: string
  effectiveDate: string | null
  extraFields: Record<string, unknown>
  createdAt: string
  createdBy: string | null
} & Record<string, unknown>

export type Inspection = {
  id: string
  companyId: string
  establishmentId: string
  entryId: string | null
  visitDate: string
  inspecteurNom: string
  inspecteurFonction: string | null
  inspecteurService: string | null
  typeVisite: string | null
  objetVisite: string | null
  constatations: string | null
  infractions: string
  mesuresPrescrites: string
  baseLegale: string | null
  delaiExecution: string
  observationsEmployeur: string | null
  suiteDonnee: string | null
  dateRegularisation: string | null
  referenceProcesVerbal: string | null
  miseEnDemeure: boolean
  status: InspectionStatus
  locked: boolean
  extraFields: Record<string, unknown>
  createdAt: string
  createdBy: string | null
}

export type EmployerDocument = {
  id: string
  entryId: string | null
  inspectionId: string | null
  employeeId: string | null
  docType: string | null
  fileName: string | null
  pathname: string
  uploadedAt: string
  uploadedBy: string | null
  removedAt: string | null
  removedBy: string | null
}

export type AuditRow = {
  id: string
  registerPart: string | null
  registerEntryId: string | null
  employeeId: string | null
  actionType: AuditActionType
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  reason: string | null
  createdAt: string
  createdBy: string | null
  userRole: string | null
  documentReference: string | null
}

export type ExportRecord = {
  id: string
  registerPart: string
  exportNumber: number
  version: number
  checksum: string | null
  pdfPathname: string | null
  includedEntryIds: string[]
  createdAt: string
  createdBy: string | null
}

export type SpecialRegisterRow = {
  id: string
  entryId: string
  category: SpecialCategory
  extraFields: Record<string, unknown>
  createdAt: string
  createdBy: string | null
}

export type DashboardStats = {
  total: number
  active: number
  sorti: number
  incomplete: number
  missingCin: number
  missingCnaps: number
  contractsExpiringSoon: number
  inspectionsTotal: number
  openMiseEnDemeure: number
  upcomingDeadlines: number
  overdueMeasures: number
}

// Vrsta duplikata pri preverjanju (spec §6)
export type DuplicateMatch = {
  entryId: string
  ordreNumber: number
  nom: string | null
  prenoms: string | null
  reason: 'cin' | 'passeport' | 'nomNaissance' | 'cnaps'
}

export const DUPLICATE_REASON_LABELS: Record<DuplicateMatch['reason'], string> = {
  cin: 'Même numéro CIN',
  passeport: 'Même numéro de passeport',
  nomNaissance: 'Mêmes nom, prénoms et date de naissance',
  cnaps: 'Même numéro CNAPS',
}

export const DUPLICATE_REASON_LABELS_SL: Record<DuplicateMatch['reason'], string> = {
  cin: 'Enaka številka osebne izkaznice (CIN)',
  passeport: 'Enaka številka potnega lista',
  nomNaissance: 'Enak priimek, ime in datum rojstva',
  cnaps: 'Enaka številka CNAPS',
}

// Oznaka za zacasne izvoze (spec §15)
export const PROVISIONAL_WATERMARK = 'MODÈLE PROVISOIRE – MISE EN PAGE À VALIDER'

// =====================================================================
// URADNA OBRAZCA (dopolnitev): Déclaration d'établissement + Renseignements
// périodiques. Uporabljata obstoječe podatke obrata/podjetja (snapshot ob
// izdelavi), obstoječi sistem izvozov, dokumentov in revizijske sledi.
// =====================================================================

// --- 1) Déclaration d'établissement ---

// Predmet prijave (spec: Objet de la présente déclaration)
export const DECLARATION_OBJET_OPTIONS: { id: string; label: string; labelSl: string }[] = [
  { id: 'ouverture', label: 'Ouverture d’un nouvel établissement', labelSl: 'Odprtje novega obrata' },
  { id: 'reprise', label: 'Reprise d’un établissement', labelSl: 'Prevzem obrata' },
  { id: 'transformation', label: 'Transformation de l’établissement', labelSl: 'Preoblikovanje obrata' },
  { id: 'changementActivite', label: 'Changement d’activité', labelSl: 'Sprememba dejavnosti' },
  { id: 'changementProprietaire', label: 'Changement de propriétaire', labelSl: 'Sprememba lastnika' },
  { id: 'transfert', label: 'Transfert de l’établissement', labelSl: 'Premestitev obrata' },
  { id: 'fermeture', label: 'Fermeture de l’établissement', labelSl: 'Zaprtje obrata' },
  { id: 'autre', label: 'Autre', labelSl: 'Drugo' },
]

// Polja obrazca prijave (poleg objet/objetPrecisions, ki ju vodimo posebej).
export const DECLARATION_FIELDS: FieldDef[] = [
  // Podatki obrata (snapshot iz obstoječega zapisa; urejljivi v obrazcu)
  { key: 'nom', label: 'Nom de l’établissement', labelSl: 'Ime obrata', type: 'text', group: 'Établissement' },
  { key: 'nomCommercial', label: 'Nom commercial', labelSl: 'Komercialno ime', type: 'text', group: 'Établissement' },
  { key: 'raisonSociale', label: 'Raison sociale', labelSl: 'Firma / naziv podjetja', type: 'text', group: 'Établissement' },
  { key: 'formeJuridique', label: 'Forme juridique', labelSl: 'Pravna oblika', type: 'text', group: 'Établissement' },
  { key: 'adresseEtablissement', label: 'Adresse de l’établissement', labelSl: 'Naslov obrata', type: 'text', group: 'Établissement' },
  { key: 'activitePrincipale', label: 'Activité principale', labelSl: 'Glavna dejavnost', type: 'text', group: 'Établissement' },
  { key: 'activitesSecondaires', label: 'Activités secondaires', labelSl: 'Stranske dejavnosti', type: 'textarea', group: 'Établissement' },
  // Datumi (nova polja)
  { key: 'datePrevueOuverture', label: 'Date prévue d’ouverture', labelSl: 'Predvideni datum odprtja', type: 'date', group: 'Dates' },
  { key: 'dateEffectiveOuverture', label: 'Date effective d’ouverture', labelSl: 'Dejanski datum odprtja', type: 'date', group: 'Dates' },
  { key: 'dateDeclaration', label: 'Date de la déclaration', labelSl: 'Datum prijave', type: 'date', group: 'Dates' },
  // Matično podjetje
  { key: 'appartientEntrepriseMultiple', label: 'L’établissement fait-il partie d’une entreprise comportant plusieurs établissements ?', labelSl: 'Ali obrat spada v podjetje z več obrati?', type: 'boolean', group: 'Entreprise / maison mère' },
  { key: 'nomEntrepriseMere', label: 'Nom ou raison sociale de l’entreprise mère', labelSl: 'Ime ali firma matičnega podjetja', type: 'text', group: 'Entreprise / maison mère' },
  { key: 'adresseSiegeMere', label: 'Adresse du siège social ou de la maison mère', labelSl: 'Naslov sedeža ali matične hiše', type: 'text', group: 'Entreprise / maison mère' },
  // Podpis
  { key: 'observations', label: 'Observations', labelSl: 'Opombe', type: 'textarea', group: 'Signature' },
  { key: 'faitA', label: 'Fait à', labelSl: 'Sestavljeno v', type: 'text', group: 'Signature' },
  { key: 'nomDeclarant', label: 'Nom du déclarant', labelSl: 'Ime prijavitelja', type: 'text', group: 'Signature' },
  { key: 'fonctionDeclarant', label: 'Fonction du déclarant', labelSl: 'Funkcija prijavitelja', type: 'text', group: 'Signature' },
  { key: 'dateSignature', label: 'Date de signature', labelSl: 'Datum podpisa', type: 'date', group: 'Signature' },
]

// Polja obrata, ki se ob izdelavi PREPIŠEJO (snapshot) iz zapisa obrata.
export const DECLARATION_SNAPSHOT_KEYS = ['nom', 'nomCommercial', 'raisonSociale', 'adresseEtablissement', 'activitePrincipale'] as const

export type DeclarationStatus = 'draft' | 'signed' | 'deposited' | 'archived'
export const DECLARATION_STATUS_LABELS: Record<DeclarationStatus, string> = {
  draft: 'Brouillon', signed: 'Signé', deposited: 'Déposé', archived: 'Archivé',
}
export const DECLARATION_STATUS_LABELS_SL: Record<DeclarationStatus, string> = {
  draft: 'Osnutek', signed: 'Podpisano', deposited: 'Vloženo', archived: 'Arhivirano',
}

export type EmployerDeclaration = {
  id: string
  companyId: string
  establishmentId: string
  objet: string | null
  objetPrecisions: string | null
  data: Record<string, unknown>
  status: DeclarationStatus
  hideProvisional: boolean
  signedDocPathname: string | null
  dateDepot: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  signedAt: string | null
  depositedAt: string | null
  archivedAt: string | null
}

// --- 2) Renseignements périodiques (samo 1. stran) ---

export const PERIODIC_STATUSES = ['draft', 'a_completer', 'pret', 'signe', 'envoye', 'archive'] as const
export type PeriodicStatus = (typeof PERIODIC_STATUSES)[number]
export const PERIODIC_STATUS_LABELS: Record<PeriodicStatus, string> = {
  draft: 'Brouillon', a_completer: 'À compléter', pret: 'Prêt à imprimer', signe: 'Signé', envoye: 'Envoyé', archive: 'Archivé',
}
export const PERIODIC_STATUS_LABELS_SL: Record<PeriodicStatus, string> = {
  draft: 'Osnutek', a_completer: 'Za dopolnitev', pret: 'Pripravljeno za tisk', signe: 'Podpisano', envoye: 'Poslano', archive: 'Arhivirano',
}

// Glavni podatki dokumenta (1. stran, zgornji del)
export const PERIODIC_HEADER_FIELDS: FieldDef[] = [
  { key: 'annee', label: 'Année', labelSl: 'Leto', type: 'number', group: 'Document' },
  { key: 'periode', label: 'Période concernée', labelSl: 'Zadevno obdobje', type: 'text', group: 'Document' },
  { key: 'documentNumber', label: 'Numéro du document', labelSl: 'Številka dokumenta', type: 'text', group: 'Document' },
  { key: 'dateEnvoiQuestionnaire', label: 'Date d’envoi du questionnaire', labelSl: 'Datum pošiljanja vprašalnika', type: 'date', group: 'Document' },
]

// 2 – Entreprise mère (iz obstoječih podatkov podjetja)
export const PERIODIC_MERE_FIELDS: FieldDef[] = [
  { key: 'mereNomRaisonSociale', label: 'Nom ou raison sociale', labelSl: 'Ime ali firma', type: 'text', group: 'Entreprise mère' },
  { key: 'mereAdresse', label: 'Adresse', labelSl: 'Naslov', type: 'text', group: 'Entreprise mère' },
  { key: 'mereStat', label: 'N° d’identification statistique', labelSl: 'Statistična identifikacijska št.', type: 'text', group: 'Entreprise mère' },
  { key: 'mereFormeJuridique', label: 'Forme juridique', labelSl: 'Pravna oblika', type: 'text', group: 'Entreprise mère' },
  { key: 'mereNationaliteChef', label: 'Nationalité du chef', labelSl: 'Državljanstvo vodje', type: 'text', group: 'Entreprise mère' },
  { key: 'mereNomChef', label: 'Nom du chef ou représentant légal', labelSl: 'Ime vodje ali zakonitega zastopnika', type: 'text', group: 'Entreprise mère' },
  { key: 'mereSansObjet', label: 'Sans objet', labelSl: 'Se ne uporablja', type: 'boolean', group: 'Entreprise mère' },
]

// 3 – Établissement enquêté (iz obstoječih podatkov obrata)
export const PERIODIC_ETAB_FIELDS: FieldDef[] = [
  { key: 'etabNomDenomination', label: 'Nom ou dénomination', labelSl: 'Ime ali oznaka', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabStat', label: 'N° d’identification statistique', labelSl: 'Statistična identifikacijska št.', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabCnaps', label: 'N° d’identification à la CNaPS', labelSl: 'Identifikacijska št. CNaPS', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabNomDirecteur', label: 'Nom du directeur ou du responsable', labelSl: 'Ime direktorja ali odgovorne osebe', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabFonctionResponsable', label: 'Fonction du responsable', labelSl: 'Funkcija odgovorne osebe', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabNationalite', label: 'Nationalité', labelSl: 'Državljanstvo', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabAdresse', label: 'Adresse', labelSl: 'Naslov', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabRue', label: 'Rue', labelSl: 'Ulica', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabCommune', label: 'Commune', labelSl: 'Občina', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabDistrict', label: 'District', labelSl: 'Okrožje', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabRegion', label: 'Région', labelSl: 'Regija', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabFaritany', label: 'Faritany', labelSl: 'Faritany (pokrajina)', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabActivitePrincipale', label: 'Activité principale', labelSl: 'Glavna dejavnost', type: 'text', group: 'Établissement enquêté' },
  { key: 'etabActivitesSecondaires', label: 'Activités secondaires', labelSl: 'Stranske dejavnosti', type: 'textarea', group: 'Établissement enquêté' },
  { key: 'dateEnvoiQuestionnaire', label: 'Date d’envoi du questionnaire', labelSl: 'Datum pošiljanja vprašalnika', type: 'date', group: 'Établissement enquêté' },
  { key: 'nomSignataire', label: 'Nom du signataire', labelSl: 'Ime podpisnika', type: 'text', group: 'Établissement enquêté' },
  { key: 'fonctionSignataire', label: 'Fonction du signataire', labelSl: 'Funkcija podpisnika', type: 'text', group: 'Établissement enquêté' },
  { key: 'dateSignature', label: 'Date de signature', labelSl: 'Datum podpisa', type: 'date', group: 'Établissement enquêté' },
  { key: 'observations', label: 'Observations', labelSl: 'Opombe', type: 'textarea', group: 'Établissement enquêté' },
]

export type PeriodicReport = {
  id: string
  companyId: string
  establishmentId: string
  year: number | null
  periode: string | null
  documentNumber: string | null
  dateEnvoi: string | null
  status: PeriodicStatus
  hideProvisional: boolean
  data: Record<string, unknown>
  signedDocPathname: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  signedAt: string | null
  sentAt: string | null
  archivedAt: string | null
}

// Vrste dokumentov za obstoječi zavihek Documents (predlogi).
export const OFFICIAL_DOCUMENT_TYPES: { fr: string; sl: string }[] = [
  { fr: 'Déclaration d’établissement', sl: 'Prijava obrata' },
  { fr: 'Renseignements périodiques', sl: 'Periodični podatki' },
  { fr: 'Formulaire officiel vierge', sl: 'Prazen uradni obrazec' },
  { fr: 'Formulaire signé', sl: 'Podpisan obrazec' },
  { fr: 'Preuve de dépôt', sl: 'Dokazilo o vložitvi' },
]

// Sporočilo za manjkajoče strani obrazca Renseignements périodiques (spec §3).
export const PERIODIC_COMPLEMENTARY_NOTICE =
  'Les pages complémentaires du formulaire officiel seront ajoutées après réception des modèles lisibles.'

// Preprosta kontrolna vsota (nekriptografska) za zaklep izvoza (spec §12).
export function computeChecksum(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul((h2 + c) ^ (c << 3), 0x85ebca6b) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase()
}
