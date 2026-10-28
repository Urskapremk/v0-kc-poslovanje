// Obrazec FORMULAIRE PREQUALIFICATION FOURNISSEUR.
// Izpolnjena so samo polja, ki so berljiva na posnetkih dokumentov podjetja.
// Neznana polja ostanejo prazna.

export type PrequalificationCompany = 'tourism' | 'sarl'

export type FormRow =
  | { type: 'section'; fr: string; sl: string }
  | { type: 'field'; id: string; fr: string; sl: string }
  | { type: 'columns'; fr: string[]; sl: string[] }

export const PREQUALIFICATION_ROWS: FormRow[] = [
  { type: 'section', fr: 'PREQUALIFICATION FOURNISSEUR', sl: 'Predkvalifikacija dobavitelja' },
  { type: 'section', fr: 'IDENTIFICATION DU FOURNISSEUR', sl: 'Identifikacija dobavitelja' },
  { type: 'field', id: 'companyName', fr: 'Nom de la Société', sl: 'Ime družbe' },
  {
    type: 'field',
    id: 'legalForm',
    fr: 'Raison Sociale (EI, SARLU, SARL, SA, SDET, EPIC, société civile,…)',
    sl: 'Pravna oblika (EI, SARLU, SARL, SA, SDET, EPIC, civilna družba, …)',
  },
  { type: 'field', id: 'address', fr: 'Adresse', sl: 'Naslov' },
  { type: 'field', id: 'activity', fr: 'Activité de la société', sl: 'Dejavnost družbe' },
  { type: 'field', id: 'created', fr: 'Date de création de la société', sl: 'Datum ustanovitve družbe' },
  { type: 'field', id: 'nif', fr: "Numéro d'identification fiscal (NIF)", sl: 'Davčna številka (NIF)' },
  { type: 'field', id: 'stat', fr: 'Numéro statistique (STAT)', sl: 'Statistična številka (STAT)' },
  { type: 'field', id: 'rcs', fr: 'Numéro RCS', sl: 'Številka RCS' },
  { type: 'field', id: 'bank', fr: 'Nom et adresse de la banque', sl: 'Ime in naslov banke' },
  { type: 'field', id: 'account', fr: 'Numéro de compte / RIB', sl: 'Številka računa / RIB' },
  { type: 'field', id: 'swift', fr: 'swift', sl: 'SWIFT' },
  { type: 'field', id: 'payment', fr: 'Modalité de paiement', sl: 'Način plačila' },
  { type: 'field', id: 'staffCount', fr: 'Nombre de salariés', sl: 'Število zaposlenih' },
  {
    type: 'columns',
    fr: ['Personne à contacter', 'Aspects contractuels & commerciaux'],
    sl: ['Kontaktna oseba', 'Pogodbeni in poslovni vidiki'],
  },
  { type: 'field', id: 'contactName', fr: 'Nom & Prénom', sl: 'Ime in priimek' },
  { type: 'field', id: 'contactRole', fr: 'Fonction', sl: 'Funkcija' },
  { type: 'field', id: 'contactReach', fr: 'E-mail & Tél', sl: 'E-pošta in telefon' },

  { type: 'section', fr: "CONFLITS D'INTERETS", sl: 'Nasprotja interesov' },
  {
    type: 'field',
    id: 'conflict',
    fr: 'Avez-vous une relation directe (parent ou relation proche) travaillant au sein de la société VITOGAZ MADAGASCAR ? OUI / NON',
    sl: 'Ali imate neposredno razmerje (starš ali bližnji) z osebo, ki dela v družbi VITOGAZ MADAGASCAR? DA / NE',
  },
  {
    type: 'field',
    id: 'conflictWho',
    fr: 'Si « oui », veuillez nous confirmer le nom + fonction de la personne au sein de VITOGAZ',
    sl: 'Če je odgovor da, navedite ime in funkcijo osebe v VITOGAZ',
  },

  { type: 'section', fr: "DROIT DE L'HOMME", sl: 'Človekove pravice' },
  { type: 'section', fr: 'I- Egalité', sl: 'I – Enakost' },
  {
    type: 'field',
    id: 'equality',
    fr: "Disposez-vous d'une politique d'égalité et de non-discrimination (égalité de traitement des employés quel que soit le genre, l'orientation sexuelle, la race ou la religion) ? OUI / NON",
    sl: 'Ali imate politiko enakosti in nediskriminacije (enako obravnavanje zaposlenih ne glede na spol, spolno usmerjenost, raso ali vero)? DA / NE',
  },
  {
    type: 'field',
    id: 'equalityDoc',
    fr: 'Si « oui », veuillez nous fournir un exemplaire du dit document',
    sl: 'Če je odgovor da, priložite izvod tega dokumenta',
  },
  { type: 'section', fr: 'II- Travail forcé', sl: 'II – Prisilno delo' },
  {
    type: 'field',
    id: 'forcedLabour',
    fr: "Disposez-vous d'une politique interdisant le travail forcé, quelle qu'en soit la forme (par ex., heures supplémentaires obligatoires, travaux d'intérêt général) ? OUI / NON",
    sl: 'Ali imate politiko, ki prepoveduje prisilno delo v kakršni koli obliki (npr. obvezne nadure, dela v splošno korist)? DA / NE',
  },
  {
    type: 'field',
    id: 'forcedLabourDoc',
    fr: 'Si « oui », veuillez nous fournir un exemplaire du dit document',
    sl: 'Če je odgovor da, priložite izvod tega dokumenta',
  },

  { type: 'section', fr: 'ENVIRONNEMENT & QUALITE', sl: 'Okolje in kakovost' },
  { type: 'section', fr: 'I- Gestion des impacts environnementaux', sl: 'I – Obvladovanje okoljskih vplivov' },
  {
    type: 'field',
    id: 'waste',
    fr: 'Quel est la nature des déchets principaux que vous générez ?',
    sl: 'Kakšni so glavni odpadki, ki jih ustvarjate?',
  },
  {
    type: 'field',
    id: 'envGoals',
    fr: 'Votre entreprise a-t-elle défini et documenté des objectifs environnementaux pour réduire les impacts écologiques ? OUI / NON',
    sl: 'Ali je družba določila in dokumentirala okoljske cilje za zmanjšanje ekoloških vplivov? DA / NE',
  },
  {
    type: 'field',
    id: 'responsibleBuying',
    fr: "Votre entreprise a-t-elle mis en place une politique d'achat responsable et réduction empreinte carbone ? OUI / NON",
    sl: 'Ali ima družba politiko odgovornega nabave in zmanjšanja ogljičnega odtisa? DA / NE',
  },
  {
    type: 'section',
    fr: 'II- Certification Santé, Sécurité, Environnement, Qualité, Responsabilité sociétale',
    sl: 'II – Certifikati za zdravje, varnost, okolje, kakovost in družbeno odgovornost',
  },
  {
    type: 'field',
    id: 'iso',
    fr: "Disposez-vous d'une certification en matière de Sécurité, et/ou Environnement, et/ou Qualité ? (ex : ISO 9001, 14001, …) OUI / NON",
    sl: 'Ali imate certifikat za varnost in/ali okolje in/ali kakovost? (npr. ISO 9001, 14001, …) DA / NE',
  },
  {
    type: 'field',
    id: 'isoWhich',
    fr: 'Si « oui », laquelle / lesquelles ?',
    sl: 'Če je odgovor da, kateri?',
  },

  { type: 'section', fr: 'SECURITE & SANTE', sl: 'Varnost in zdravje' },
  { type: 'section', fr: 'I- Evaluation du risque', sl: 'I – Ocena tveganja' },
  {
    type: 'field',
    id: 'riskAnalysis',
    fr: 'Faites-vous une analyse des risques pour chaque tâche dans vos activités ? OUI / NON',
    sl: 'Ali za vsako nalogo v svoji dejavnosti naredite oceno tveganja? DA / NE',
  },
  {
    type: 'field',
    id: 'riskDoc',
    fr: 'Si « oui », veuillez nous fournir un exemplaire du dit document',
    sl: 'Če je odgovor da, priložite izvod tega dokumenta',
  },
  {
    type: 'field',
    id: 'dangerousWork',
    fr: 'Votre entreprise réalise-t-elle des travaux dangereux (travail en espace confiné, travaux par points chauds, travaux en hauteur, etc.) sur le site de vos clients ? OUI / NON',
    sl: 'Ali družba pri strankah izvaja nevarna dela (zaprt prostor, vroča dela, delo na višini itd.)? DA / NE',
  },
  {
    type: 'field',
    id: 'clientRisk',
    fr: "Si « oui », est-ce que votre client vous demande de compléter une analyse de risque (plan de prévention, autorisation de travail, permis spécifiques) lorsqu'elle intervient sur le site d'un de ses clients ?",
    sl: 'Če je odgovor da, ali stranka zahteva oceno tveganja (načrt preventive, dovoljenje za delo, posebna dovoljenja), ko delate pri njeni stranki?',
  },
  { type: 'section', fr: 'II- EPI (Equipements de Protection Individuelle)', sl: 'II – Osebna varovalna oprema' },
  {
    type: 'field',
    id: 'ppe',
    fr: 'Votre société fournit-elle des EPI à tout le personnel et tâche appropriée ? OUI / NON',
    sl: 'Ali družba vsemu osebju zagotovi osebno varovalno opremo, primerno nalogi? DA / NE',
  },
  { type: 'section', fr: "III- Procédures en matière d'accidents et d'incidents", sl: 'III – Postopki ob nesrečah in incidentih' },
  {
    type: 'field',
    id: 'accidents',
    fr: "Votre société dispose-t-elle d'une politique exigeant des rapports écrits d'accidents/incidents (déversements, blessures, dégâts matériels, incendies, explosions, …) ? OUI / NON",
    sl: 'Ali ima družba politiko, ki zahteva pisna poročila o nesrečah in incidentih (razlitja, poškodbe, materialna škoda, požari, eksplozije, …)? DA / NE',
  },

  { type: 'section', fr: 'ANTI-CORRUPTION', sl: 'Protikorupcija' },
  {
    type: 'section',
    fr: "Propriétaires, directs ou indirects, et leurs pourcentages d'intérêt (si la société est cotée, seulement les actionnaires détenant plus de 5 % du capital ou des droits de vote).",
    sl: 'Neposredni ali posredni lastniki in njihov delež (če je družba na borzi, samo delničarji z več kot 5 % kapitala ali glasovalnih pravic).',
  },
  {
    type: 'columns',
    fr: ['Nom des actionnaires directs ou indirects', '% de détention du capital ou des droits de vote'],
    sl: ['Ime neposrednih ali posrednih delničarjev', '% kapitala ali glasovalnih pravic'],
  },
  {
    type: 'section',
    fr: 'Dirigeants et administrateurs de votre société',
    sl: 'Vodstvo in upravitelji družbe',
  },
  {
    type: 'columns',
    fr: ['Nom', 'Nationalité', 'Pays de résidence', 'Fonction exercée'],
    sl: ['Ime', 'Državljanstvo', 'Država prebivališča', 'Funkcija'],
  },
  {
    type: 'field',
    id: 'antiCorruption',
    fr: "Votre société dispose-t-elle d'une procédure ou politique anti-corruption ? OUI / NON",
    sl: 'Ali ima družba protikorupcijski postopek ali politiko? DA / NE',
  },
  {
    type: 'field',
    id: 'antiCorruptionDoc',
    fr: 'Si « oui », veuillez nous fournir un exemplaire du dit document',
    sl: 'Če je odgovor da, priložite izvod tega dokumenta',
  },
  {
    type: 'field',
    id: 'publicOffice',
    fr: "L'un de vos propriétaires, dirigeants ou administrateurs exerce-t-il des fonctions dans l'administration (gouvernement, agence gouvernementale, parti politique) ou a-t-il des liens familiaux avec un agent public ? OUI / NON",
    sl: 'Ali kdo od lastnikov, vodstva ali upraviteljev opravlja funkcijo v upravi (vlada, vladna agencija, politična stranka) ali ima družinske vezi z javnim uslužbencem? DA / NE',
  },
  {
    type: 'columns',
    fr: ['Nom + Fonction au sein de votre société', "Nom + Fonction au sein de l'administration ou de l'agent public lié"],
    sl: ['Ime in funkcija v vaši družbi', 'Ime in funkcija v upravi oziroma povezanega javnega uslužbenca'],
  },
  {
    type: 'field',
    id: 'conviction',
    fr: "À votre connaissance, votre société, les entités qu'elle contrôle, l'un de leurs employés, dirigeants ou actionnaires ont-ils déjà fait l'objet d'une condamnation pour fraude ou corruption ? OUI / NON",
    sl: 'Ali so bili po vašem vedenju družba, obvladovane družbe, zaposleni, vodstvo ali delničarji že obsojeni zaradi goljufije ali korupcije? DA / NE',
  },
  {
    type: 'field',
    id: 'convictionDetail',
    fr: 'Si « oui », merci de décrire les faits et les mesures correctives mises en œuvre',
    sl: 'Če je odgovor da, opišite dejstva in sprejete popravne ukrepe',
  },
  {
    type: 'field',
    id: 'subcontractors',
    fr: "Si vous avez recours à des sous-traitants ou intermédiaires dans le cadre de vos relations contractuelles avec le Groupe Rubis, merci de donner leur nom, leur activité et leurs liens éventuels avec l'administration ou l'un de ses agents. OUI / NON",
    sl: 'Če v pogodbenih razmerjih s skupino Rubis uporabljate podizvajalce ali posrednike, navedite njihovo ime, dejavnost in morebitne vezi z upravo ali njenim uslužbencem. DA / NE',
  },
  {
    type: 'columns',
    fr: ['Nom', 'Activité', "Liens avec l'administration ou l'un de ses agents"],
    sl: ['Ime', 'Dejavnost', 'Vezi z upravo ali njenim uslužbencem'],
  },
  { type: 'field', id: 'signName', fr: 'Nom :', sl: 'Ime:' },
  { type: 'field', id: 'signature', fr: 'Signature :', sl: 'Podpis:' },
  { type: 'field', id: 'stamp', fr: 'Cachet', sl: 'Žig' },
  { type: 'field', id: 'placeDate', fr: 'Fait à : ……………… le : ………………', sl: 'Kraj: ……………… datum: ………………' },
]

// Prebrano s posnetkov, prilepljenih 28. 10. 2026. Prazno pomeni, da na slikah ni bilo berljivega podatka.
export const PREQUALIFICATION_VALUES: Record<PrequalificationCompany, Record<string, string>> = {
  tourism: {
    companyName: 'KOMBA CABANA TOURISM SARL',
    legalForm: 'SARL',
    address: 'VILLA MADINA I TFN-4507-E ANDREKAREKA BE',
    activity: 'Location hebergement touristiques -restaurant - import export',
    nif: '2003136139',
    stat: '56101 71 2018 0 10452',
    rcs: 'NB2018B046',
    bank: '00026 NOSY BE',
    account: '00004 00026 03002920101 73, IBAN MG46 0000 4000 2603 0029 2010 173',
    swift: 'BMOIMGMG',
  },
  sarl: {
    companyName: 'KOMBA CABANA SARL',
    legalForm: 'SARL',
    address: 'VILLA MADINA I EMPHYTEOSE TFN-4507-BO ANDREKAREKA',
    nif: '4003163768',
    stat: '55101 71 2018 0 10409',
    rcs: 'NB2018B053',
    bank: '00026 NOSY BE',
    account: '00004 00026 03074120101 87, IBAN MG46 0000 4000 2603 0741 2010 187',
    swift: 'BMOIMGMG',
  },
}

export function prequalificationValue(company: PrequalificationCompany, id: string): string {
  return PREQUALIFICATION_VALUES[company][id] ?? ''
}
