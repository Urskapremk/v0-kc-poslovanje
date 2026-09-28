/**
 * Turns a free-text nationality into a country flag.
 *
 * The nationality field is typed by hand (and imported from Bentral), so the same
 * country arrives in many shapes: Slovenian ("Nemčija"), English ("Germany"),
 * the adjective ("German", "swiss") and the occasional typo ("Switcerland").
 * Everything is folded down to one key before lookup, so all of those land on DE / CH.
 */

/** Lowercase, strip accents and punctuation so "Švica", "svica" and "SWICA" all match. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // drop the combining accents (š → s, č → c)
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** [ISO 3166-1 alpha-2, Slovenian display name, spellings seen in the wild] */
const COUNTRIES: Array<[string, string, string[]]> = [
  ["FR", "Francija", ["france", "francija", "french", "francais", "francaise", "fr"]],
  ["MG", "Madagaskar", ["madagascar", "madagaskar", "malagasy", "mg"]],
  ["GB", "Velika Britanija", ["united kingdom", "velika britanija", "great britain", "britain", "british", "england", "english", "scotland", "wales", "uk", "gb"]],
  ["DE", "Nemčija", ["germany", "nemcija", "german", "deutschland", "getman", "de"]],
  ["CH", "Švica", ["switzerland", "svica", "swiss", "switcerland", "suisse", "schweiz", "ch"]],
  ["AT", "Avstrija", ["austria", "avstrija", "austrian", "osterreich", "at"]],
  ["IT", "Italija", ["italy", "italija", "italian", "italia", "it"]],
  ["ES", "Španija", ["spain", "spanija", "spanish", "espana", "es"]],
  ["PT", "Portugalska", ["portugal", "portugalska", "portuguese", "pt"]],
  ["SE", "Švedska", ["sweden", "svedska", "swedish", "sverige", "se"]],
  ["NO", "Norveška", ["norway", "norveska", "norwegian", "no"]],
  ["DK", "Danska", ["denmark", "danska", "danish", "dk"]],
  ["FI", "Finska", ["finland", "finska", "finnish", "fi"]],
  ["IS", "Islandija", ["iceland", "islandija", "is"]],
  ["NL", "Nizozemska", ["netherlands", "nizozemska", "dutch", "holland", "nl"]],
  ["BE", "Belgija", ["belgium", "belgija", "belgian", "be"]],
  ["LU", "Luksemburg", ["luxembourg", "luksemburg", "lu"]],
  ["IE", "Irska", ["ireland", "irska", "irish", "ie"]],
  ["SI", "Slovenija", ["slovenia", "slovenija", "slovenian", "slovene", "si"]],
  ["HR", "Hrvaška", ["croatia", "hrvaska", "croatian", "hr"]],
  ["RS", "Srbija", ["serbia", "srbija", "serbian", "rs"]],
  ["MK", "Severna Makedonija", ["north macedonia", "severna makedonija", "macedonia", "makedonija", "macedonian", "makedonec", "mk"]],
  ["PL", "Poljska", ["poland", "poljska", "polish", "polska", "pl"]],
  ["CZ", "Češka", ["czech", "czechia", "ceska", "ceska republika", "cz"]],
  ["SK", "Slovaška", ["slovakia", "slovaska", "slovak", "sk"]],
  ["HU", "Madžarska", ["hungary", "madzarska", "hungarian", "hu"]],
  ["RO", "Romunija", ["romania", "romunija", "romanian", "ro"]],
  ["BG", "Bolgarija", ["bulgaria", "bolgarija", "bulgarian", "bg"]],
  ["GR", "Grčija", ["greece", "grcija", "greek", "gr"]],
  ["EE", "Estonija", ["estonia", "estonija", "estonian", "ee"]],
  ["LV", "Latvija", ["latvia", "latvija", "latvian", "lv"]],
  ["LT", "Litva", ["lithuania", "litva", "lithuanian", "lt"]],
  ["UA", "Ukrajina", ["ukraine", "ukrajina", "ukrainian", "ua"]],
  ["RU", "Rusija", ["russia", "rusija", "russian", "ru"]],
  ["TR", "Turčija", ["turkey", "turcija", "turkish", "turkiye", "tr"]],
  ["MT", "Malta", ["malta", "maltese", "mt"]],
  ["MC", "Monako", ["monaco", "monako", "monegasque", "mc"]],
  ["CY", "Ciper", ["cyprus", "ciper", "cy"]],
  ["IL", "Izrael", ["israel", "izrael", "israeli", "il"]],
  ["AE", "Združeni arabski emirati", ["united arab emirates", "zdruzeni arabski emirati", "uae", "emirates", "dubai", "ae"]],
  ["SA", "Saudova Arabija", ["saudi arabia", "saudova arabija", "saudi", "sa"]],
  ["QA", "Katar", ["qatar", "katar", "qa"]],
  ["US", "Združene države", ["united states", "united states of america", "zdruzene drzave", "zda", "usa", "american", "america", "us"]],
  ["CA", "Kanada", ["canada", "kanada", "canadian", "ca"]],
  ["MX", "Mehika", ["mexico", "mehika", "mexican", "mx"]],
  ["BR", "Brazilija", ["brazil", "brazilija", "brazilian", "brasil", "br"]],
  ["AR", "Argentina", ["argentina", "argentinian", "ar"]],
  ["CL", "Čile", ["chile", "cile", "chilean", "cl"]],
  ["PA", "Panama", ["panama", "panamanian", "pa"]],
  ["ZA", "Južnoafriška republika", ["south africa", "juznoafriska republika", "south african", "za"]],
  ["BW", "Botsvana", ["botswana", "botsvana", "bw"]],
  ["VG", "Britanski Deviški otoki", ["british virgin islands", "britanski deviski otoki", "bvi", "vg"]],
  // Bentral še vedno pošilja staro ime "Swaziland"; država se od 2018 imenuje Esvatini.
  ["SZ", "Esvatini", ["eswatini", "swaziland", "esvatini", "sz"]],
  ["EG", "Egipt", ["egypt", "egipt", "egyptian", "eg"]],
  ["MA", "Maroko", ["morocco", "maroko", "moroccan", "ma"]],
  ["TN", "Tunizija", ["tunisia", "tunizija", "tn"]],
  ["KE", "Kenija", ["kenya", "kenija", "kenyan", "ke"]],
  ["TZ", "Tanzanija", ["tanzania", "tanzanija", "tz"]],
  ["NG", "Nigerija", ["nigeria", "nigerija", "ng"]],
  ["MU", "Mavricij", ["mauritius", "mavricij", "mu"]],
  ["RE", "Reunion", ["reunion", "la reunion", "re"]],
  ["KM", "Komori", ["comoros", "komori", "comores", "km"]],
  ["SC", "Sejšeli", ["seychelles", "sejseli", "sc"]],
  ["YT", "Mayotte", ["mayotte", "yt"]],
  ["AU", "Avstralija", ["australia", "avstralija", "australian", "au"]],
  ["NZ", "Nova Zelandija", ["new zealand", "nova zelandija", "new zeland", "nz"]],
  ["CN", "Kitajska", ["china", "kitajska", "chinese", "cn"]],
  ["HK", "Hongkong", ["hong kong", "hongkong", "hk"]],
  ["JP", "Japonska", ["japan", "japonska", "japanese", "jp"]],
  ["KR", "Južna Koreja", ["south korea", "juzna koreja", "korea", "koreja", "korean", "kr"]],
  ["IN", "Indija", ["india", "indija", "indian", "in"]],
  ["TH", "Tajska", ["thailand", "tajska", "thai", "th"]],
  ["VN", "Vietnam", ["vietnam", "vietnamese", "vn"]],
  ["ID", "Indonezija", ["indonesia", "indonezija", "id"]],
  ["PH", "Filipini", ["philippines", "filipini", "ph"]],
  ["SG", "Singapur", ["singapore", "singapur", "sg"]],
  ["MY", "Malezija", ["malaysia", "malezija", "my"]],
];

const LOOKUP = new Map<string, { code: string; name: string }>();
for (const [code, name, aliases] of COUNTRIES) {
  for (const alias of aliases) LOOKUP.set(normalize(alias), { code, name });
}

/** ISO code → regional-indicator pair, e.g. "DE" → 🇩🇪 */
function toFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export type CountryFlag = { code: string; name: string; flag: string };

/**
 * Resolves a nationality string to a flag, or null when we cannot tell.
 * Falls back to the first segment so "France / Germany" still resolves.
 */
export function countryFlag(raw?: string | null): CountryFlag | null {
  if (!raw) return null;
  const candidates = [raw, ...String(raw).split(/[/,;|]/)];
  for (const candidate of candidates) {
    const hit = LOOKUP.get(normalize(candidate));
    if (hit) return { ...hit, flag: toFlagEmoji(hit.code) };
  }
  return null;
}
