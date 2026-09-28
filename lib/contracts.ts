// SHARED konstante/tipi za modul Pogodbe o zaposlitvi.
// NE sme imeti 'use server' (izvazamo tudi konstante in tipe).

export type ContractType = 'CDI' | 'CDD' | 'essai'
export type ContractLanguage = 'fr' | 'sl' | 'bilingual'
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'archived'

export const CONTRACT_TYPES: Record<ContractType, { sl: string; fr: string }> = {
  CDI: { sl: 'Pogodba za nedoločen čas', fr: 'Contrat à Durée Indéterminée (CDI)' },
  CDD: { sl: 'Pogodba za določen čas', fr: 'Contrat à Durée Déterminée (CDD)' },
  essai: { sl: 'Poskusno delo', fr: "Contrat à l'essai" },
}

export const CONTRACT_LANGUAGES: Record<ContractLanguage, string> = {
  fr: 'Francosko',
  sl: 'Slovensko',
  bilingual: 'Dvojezično (FR + SL)',
}

export const CONTRACT_STATUSES: Record<ContractStatus, { label: string; color: string }> = {
  draft: { label: 'Osnutek', color: '#98a3a2' },
  active: { label: 'Aktivna', color: '#8fae92' },
  expired: { label: 'Potekla', color: '#c59b5b' },
  terminated: { label: 'Prekinjena', color: '#e88' },
  archived: { label: 'Arhivirana', color: '#7fa8b8' },
}

// Privzeti delovni pogoji (urejljivo na pogodbi)
export const DEFAULT_WORK_HOURS = '40 heures par semaine'
export const DEFAULT_WORK_LOCATION = 'Nosy Komba, Madagascar'

// Nasa delovna mesta (FR naziv se izpise na pogodbo, SL opis za izbiro v UI).
// defaultCategory + defaultIndex = zacasna uradna nastavitev (OS1-2A / 1773) do potrditve racunovodje.
export const JOB_TITLES: { fr: string; sl: string; defaultCategory: string; defaultIndex: string }[] = [
  { fr: 'Femme de chambre', sl: 'Sobarica', defaultCategory: 'OS1-2A', defaultIndex: '1773' },
  { fr: 'Jardinier', sl: 'Vrtnar', defaultCategory: 'OS1-2A', defaultIndex: '1773' },
  { fr: 'Commis cuisine', sl: 'Kuhinjski pomočnik', defaultCategory: 'OS1-2A', defaultIndex: '1773' },
  { fr: 'Cuisinier', sl: 'Kuhar', defaultCategory: 'OS1-2A', defaultIndex: '1773' },
  { fr: 'Serveur', sl: 'Natakar', defaultCategory: 'OS1-2A', defaultIndex: '1773' },
]

// Privzete vrednosti za vsa delovna mesta (do uradne potrditve racunovodje)
export const DEFAULT_CATEGORY = 'OS1-2A'
export const DEFAULT_INDEX = '1773'

export type ContractSnapshot = {
  firstName?: string
  lastName?: string
  staffName?: string
  gender?: string
  dateOfBirth?: string | null
  placeOfBirth?: string
  nationality?: string
  fatherName?: string
  motherName?: string
  documentNumber?: string
  cnapsNumber?: string
  ominoNumber?: string
  address?: string
  phone?: string
  email?: string
}

export type CompanySettings = {
  id: string
  name: string
  address: string
  nifNumber: string
  statNumber: string
  rcsNumber: string
  repName: string
  repTitle: string
}

export type Contract = {
  id: string
  contractNumber: string
  staffId: string
  staffName: string
  company: string
  contractType: ContractType
  jobTitle: string
  category: string
  index: string
  startDate: string | null
  endDate: string | null
  trialMonths: number
  salary: number
  workLocation: string
  workHours: string
  language: ContractLanguage
  status: ContractStatus
  snapshot: ContractSnapshot | null
  notes: string
  signedAt: string | null
  createdAt: string
  updatedAt: string
}

// --- Pomozne funkcije ---

export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateSl(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function genderLabelFr(g: string | undefined): string {
  if (g === 'M') return 'Monsieur'
  if (g === 'Z' || g === 'F') return 'Madame'
  return ''
}

// Stevilka pogodbe: KC-{COMPANY}-{LETO}-{ZAP}
// npr. KC-TOURISM-2026-001
export function buildContractNumber(companyId: string, year: number, seq: number): string {
  const comp = companyId === 'sarl' ? 'SARL' : 'TOURISM'
  return `KC-${comp}-${year}-${String(seq).padStart(3, '0')}`
}

// Polno ime zaposlenega iz snapshota (priimek + ime, sicer staffName)
export function fullNameFromSnapshot(s: ContractSnapshot | null, fallback: string): string {
  if (!s) return fallback
  const composed = [s.lastName, s.firstName].filter(Boolean).join(' ').trim()
  return composed || s.staffName || fallback
}

// Stevilka v francoskem zapisu
function fr(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

// Razclenitev place (po konvenciji aplikacije: vneseni salary = NETO placa)
// CNAPS 1%, OMINO 1% od bruto; IRSA 3000 ce je osnova 262680-423000.
export type ContractSalaryBreakdown = {
  net: number
  cnaps: number
  omino: number
  irsa: number
  totalDeductions: number
  gross: number
}

export function contractSalaryBreakdown(net: number): ContractSalaryBreakdown {
  // bruto = neto + odbitki; odbitki = CNAPS(1%)+OMINO(1%) od bruto + IRSA
  // Po payroll modulu: cnaps/omino se racunata od osnove (neto), IRSA pavsal.
  const cnaps = Math.round(net * 0.01)
  const omino = Math.round(net * 0.01)
  const irsa = net >= 262680 && net <= 423000 ? 3000 : 0
  const totalDeductions = cnaps + omino + irsa
  const gross = net + totalDeductions
  return { net, cnaps, omino, irsa, totalDeductions, gross }
}

// Pretvori stevilo v besede (francosko) za znesek place - poenostavljeno za tipicne place
function numberToFrenchWords(n: number): string {
  // Za znesek place je dovolj priblizek; ce ni v slovarju, vrnemo stevilko + "ariary"
  return `${fr(n)} ariary`
}

export type ContractArticle = { num: string; title: string; body: string }

// Generira clene 1-17 po referencni pogodbi, s podatki iz pogodbe.
export function buildContractArticles(
  contract: Contract,
  company: CompanySettings | undefined,
): ContractArticle[] {
  const isCDD = contract.contractType === 'CDD'
  const job = contract.jobTitle || '—'
  const cat = contract.category || ''
  const idx = contract.index || ''
  const sb = contractSalaryBreakdown(contract.salary || 0)
  const lieu = company?.address || contract.workLocation || 'Nosy Komba, Madagascar'

  // Clen 3 (Durée) glede na tip pogodbe
  let dureeBody: string
  if (isCDD) {
    const debut = formatDateFr(contract.startDate)
    const fin = formatDateFr(contract.endDate)
    dureeBody =
      `Le présent contrat est conclu pour une durée déterminée` +
      (debut ? ` à compter du ${debut}` : '') +
      (fin ? ` jusqu'au ${fin}` : '') +
      `. Les parties auront réciproquement la possibilité de résilier le présent contrat avec un préavis d'un (1) mois.`
  } else if (contract.contractType === 'essai') {
    const debut = formatDateFr(contract.startDate)
    dureeBody =
      `Le présent contrat à l'essai est conclu` +
      (debut ? ` à compter du ${debut}` : '') +
      (contract.trialMonths > 0 ? ` pour une période d'essai de ${contract.trialMonths} mois` : '') +
      `, durant laquelle chacune des parties peut y mettre fin sans préavis ni indemnité.`
  } else {
    const debut = formatDateFr(contract.startDate)
    dureeBody =
      `Le présent contrat est conclu pour une durée indéterminée` +
      (debut ? ` à compter du ${debut}` : '') +
      `. Chacune des parties pourra y mettre fin moyennant le respect d'un préavis conforme au code du travail malgache.`
  }

  // Clen 4 (Rémunération)
  const remBody =
    `Le travailleur perçoit une rémunération de plein temps, à savoir :\n` +
    `— Salaire de base : ${fr(sb.gross)} Ar\n` +
    `— CNAPS : ${fr(sb.cnaps)} Ar\n` +
    `— OMINO : ${fr(sb.omino)} Ar\n` +
    `— IRSA : ${fr(sb.irsa)} Ar\n` +
    `Soit un salaire NET de « ${numberToFrenchWords(sb.net)} » (${fr(sb.net)} Ar).`

  const essaiBody =
    contract.trialMonths > 0
      ? `Le contrat prévoit une période d'essai de ${contract.trialMonths} mois, durant laquelle l'employeur peut évaluer les compétences, l'attitude et l'adéquation du salarié au poste.`
      : `Le contrat peut prévoir une période d'essai d'un à trois mois, durant laquelle l'employeur peut évaluer les compétences, l'attitude et l'adéquation du salarié au poste.`

  return [
    {
      num: '1er',
      title: 'Nature et objet du contrat',
      body:
        `Le présent contrat est régi par la loi n°2024-014 du 14/08/2024 portant Code du travail à Madagascar. Il a pour objet d'embaucher le travailleur au service de son employeur. Le travailleur fournit le service à son employeur et, en contrepartie, ce dernier lui verse une rémunération mensuelle déterminée par libre consentement des parties signataires.`,
    },
    {
      num: '2',
      title: 'Fonction',
      body:
        `Aux termes du présent contrat, le travailleur est recruté en qualité de « ${job} » et, à ce titre, il est chargé de toutes les tâches incombant à cette fonction. Il s'engage à avoir une attitude honorable et ne pouvant nuire à la bonne marche ou à la bonne réputation de son employeur.` +
        (cat ? ` Il est classé dans la catégorie professionnelle ${cat}${idx ? ` indice : ${idx}` : ''}.` : ''),
    },
    { num: '3', title: 'Durée', body: dureeBody },
    { num: '4', title: 'Rémunération', body: remBody },
    {
      num: '5',
      title: "Lieu d'emploi",
      body:
        `Dans l'accomplissement de sa fonction, le lieu d'emploi est fixé à « ${lieu} ». Cependant, l'employeur pourra affecter le travailleur, d'une manière durable ou temporaire, à un autre lieu de travail, sous réserve de respecter les dispositions légales et réglementaires en vigueur.`,
    },
    {
      num: '6',
      title: 'Congé',
      body:
        `L'employé a droit au congé payé à raison de 2,5 jours par mois calendaire de service effectif. Le droit se prescrit par 3 ans. Il appartient à l'employeur de planifier le départ en congé en début d'année, pour éviter le cumul de reliquats.`,
    },
    {
      num: '7',
      title: 'Sécurité sociale et Centre médical',
      body:
        `Pour la couverture contre les risques sociaux qui pourraient survenir durant l'exécution du présent contrat, l'employeur s'engage à affilier le travailleur à la Caisse Nationale de Prévoyance Sociale (CNaPS) et à l'Organisation Médicale Interentreprises de Nosy-Be (OMINO).`,
    },
    {
      num: '8',
      title: 'Concurrence déloyale',
      body:
        `Le travailleur ne doit pas exercer une activité professionnelle susceptible de nuire ou de porter atteinte, directement ou indirectement, au bon fonctionnement de l'entreprise pendant l'exécution du présent contrat.`,
    },
    {
      num: '9',
      title: 'Résiliation',
      body:
        `Ce contrat peut être rompu à l'initiative de l'une des parties pour des motifs professionnels réels, sérieux et légitimes. Par cette rupture, aucune des parties ne peut prétendre à un droit à des indemnités liées au licenciement, sous réserve de l'article 57 du Code du travail.`,
    },
    {
      num: '10',
      title: 'Différends',
      body:
        `L'Inspection du travail est seule compétente pour régler les litiges survenus au cours de l'exécution du présent contrat. En application de l'article 264 du Code du travail malgache, pour tout litige découlant de la rupture du contrat de travail, chaque partie peut porter son action soit devant l'inspecteur du travail, soit devant le tribunal du travail du ressort.`,
    },
    {
      num: '11',
      title: 'Discipline et respect des consignes',
      body:
        `Le salarié est tenu de suivre les instructions de l'employeur, de la direction et des supérieurs hiérarchiques, et d'effectuer son travail conformément aux procédures et à l'organisation internes de l'entreprise. Toute modification non autorisée des méthodes, horaires ou procédures de travail, sans accord préalable, est interdite. Le non-respect répété des consignes constitue une faute grave.`,
    },
    { num: '12', title: "Période d'essai", body: essaiBody },
    {
      num: '13',
      title: 'Rupture du contrat pour faute grave',
      body:
        `L'employeur peut rompre le contrat sans préavis en cas de faute grave, notamment en cas de vol, de comportement violent, d'insultes envers les clients ou les employés, de travail sous l'influence de l'alcool ou de stupéfiants, de dommages intentionnels, d'insubordination répétée ou d'absences injustifiées.\n\nRespect du règlement intérieur : l'employé est tenu de respecter l'ensemble du règlement intérieur, des instructions et des règles d'organisation de l'entreprise, notamment celles relatives à l'hygiène, aux relations avec la clientèle, à la sécurité et à l'organisation du travail. L'employeur se réserve le droit de modifier ou de mettre à jour le règlement intérieur en cas de besoin.`,
    },
    {
      num: '14',
      title: 'Confidentialité',
      body:
        `L'employé s'engage à ne divulguer à des tiers aucune information commerciale, aucun tarif, aucune information relative aux clients, aucune procédure interne ni aucune autre information confidentielle de l'entreprise sans l'autorisation de l'employeur.`,
    },
    {
      num: '15',
      title: "Réputation de l'entreprise et médias sociaux",
      body:
        `L'employé s'engage à ne publier ni diffuser aucun contenu susceptible de nuire à la réputation de l'entreprise ou de ses clients, en particulier via les médias sociaux, les applications de messagerie ou tout autre canal public. Il est interdit de photographier ou de filmer les clients sans leur autorisation.`,
    },
    {
      num: '16',
      title: 'Horaires et organisation du travail',
      body:
        `Les horaires de travail, les roulements et les plannings seront adaptés aux besoins de l'entreprise et de l'exploitation de l'hôtel. L'employé accepte de travailler les week-ends, les jours fériés et selon des roulements différents en fonction des besoins opérationnels.`,
    },
    {
      num: '17',
      title: 'Responsabilité en cas de dommages',
      body:
        `L'employé est responsable des dommages causés intentionnellement ou par négligence grave, notamment la perte de matériel, de clés ou les dommages causés aux biens de l'entreprise.\n\nAvertissements écrits : en cas de manquement aux obligations professionnelles ou au règlement intérieur, l'employeur peut adresser un avertissement écrit au salarié. Les infractions répétées ou les avertissements écrits multiples peuvent constituer un motif de rupture du contrat de travail.`,
    },
  ]
}
