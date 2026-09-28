import { pgTable, text, timestamp, boolean, integer, decimal, date, jsonb } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- Komba Cabana App tables -----------------------------------------------

// Agencies
export const agencies = pgTable('agencies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contactPerson'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Guests (guest cards)
export const guests = pgTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  country: text('country'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  active: boolean('active').default(true),
})

export const reservations = pgTable('reservations', {
  id: text('id').primaryKey(),
  guestId: text('guestId').references(() => guests.id),
  bentralReservationId: text('bentralReservationId'),
  guestName: text('guestName').notNull(),
  // Naziv gosta za vljudno nagovarjanje na vaucerjih in v posti ("Mr." / "Mrs." / "Ms.").
  // Prazno = brez naziva; imena v bazi so brez njega, ker se izpisujejo tudi drugod.
  guestTitle: text('guestTitle'),
  secondGuestName: text('secondGuestName'), // Ime drugega gosta
  bungalow: text('bungalow').notNull(),
  // Obdobja po bungalovih za bivanja cez VEC bungalovov z razlicnimi datumi (gost se preseli).
  // Array [{key,bungalow,arrival,departure}]. Ce je null -> celotno bivanje v vseh bungalovih iz nizanja.
  bungalowSegments: jsonb('bungalowSegments'),
  // Stevilo otrok po starostnih razredih za prehranske popuste: { "0-5": n, "5-10": n, "10-15": n }.
  // Odrasli = pax - vsota otrok. Razredi: 0-5 brezplacno, 5-10 -50%, 10-15 -20%.
  childrenAges: jsonb('childrenAges'),
  pax: integer('pax').notNull().default(2),
  arrival: date('arrival').notNull(),
  departure: date('departure').notNull(),
  checkIn: date('checkIn'),
  checkOut: date('checkOut'),
  adults: integer('adults').default(1),
  children: integer('children').default(0),
  status: text('status').notNull().default('RESERVED'),
  bookingSource: text('bookingSource'),
  agencyName: text('agencyName'),
  nationality: text('nationality'),
  passport: text('passport'),
  dateOfBirth: text('dateOfBirth'),
  placeOfBirth: text('placeOfBirth'),
  fatherName: text('fatherName'),
  motherName: text('motherName'),
  profession: text('profession'),
  domicile: text('domicile'),
  passportDate: text('passportDate'),
  passportLieu: text('passportLieu'),
  venantDe: text('venantDe'),
  validiteVisa: text('validiteVisa'),
  allantA: text('allantA'),
  checkinToken: text('checkinToken'),
  secondNationality: text('secondNationality'),
  secondPassport: text('secondPassport'),
  secondDateOfBirth: text('secondDateOfBirth'),
  secondPlaceOfBirth: text('secondPlaceOfBirth'),
  secondFatherName: text('secondFatherName'),
  secondMotherName: text('secondMotherName'),
  secondProfession: text('secondProfession'),
  secondDomicile: text('secondDomicile'),
  secondPassportDate: text('secondPassportDate'),
  secondPassportLieu: text('secondPassportLieu'),
  secondVenantDe: text('secondVenantDe'),
  secondValiditeVisa: text('secondValiditeVisa'),
  secondAllantA: text('secondAllantA'),
  secondCheckinToken: text('secondCheckinToken'),
  thirdGuestName: text('thirdGuestName'), // Ime tretjega gosta
  thirdNationality: text('thirdNationality'),
  thirdPassport: text('thirdPassport'),
  thirdDateOfBirth: text('thirdDateOfBirth'),
  thirdPlaceOfBirth: text('thirdPlaceOfBirth'),
  thirdFatherName: text('thirdFatherName'),
  thirdMotherName: text('thirdMotherName'),
  thirdProfession: text('thirdProfession'),
  thirdDomicile: text('thirdDomicile'),
  thirdPassportDate: text('thirdPassportDate'),
  thirdPassportLieu: text('thirdPassportLieu'),
  thirdVenantDe: text('thirdVenantDe'),
  thirdValiditeVisa: text('thirdValiditeVisa'),
  thirdAllantA: text('thirdAllantA'),
  thirdCheckinToken: text('thirdCheckinToken'),
  fourthGuestName: text('fourthGuestName'), // Ime cetrtega gosta
  fourthNationality: text('fourthNationality'),
  fourthPassport: text('fourthPassport'),
  fourthDateOfBirth: text('fourthDateOfBirth'),
  fourthPlaceOfBirth: text('fourthPlaceOfBirth'),
  fourthFatherName: text('fourthFatherName'),
  fourthMotherName: text('fourthMotherName'),
  fourthProfession: text('fourthProfession'),
  fourthDomicile: text('fourthDomicile'),
  fourthPassportDate: text('fourthPassportDate'),
  fourthPassportLieu: text('fourthPassportLieu'),
  fourthVenantDe: text('fourthVenantDe'),
  fourthValiditeVisa: text('fourthValiditeVisa'),
  fourthAllantA: text('fourthAllantA'),
  fourthCheckinToken: text('fourthCheckinToken'),
  // Starostni razred na vsakem gostu (za prehranske popuste): adult | 0-5 | 5-10 | 10-15. Prazno = adult.
  guestBand: text('guestBand'),
  secondGuestBand: text('secondGuestBand'),
  thirdGuestBand: text('thirdGuestBand'),
  fourthGuestBand: text('fourthGuestBand'),
  email: text('email'),
  phone: text('phone'),
  allergies: text('allergies'),
  honeymoon: boolean('honeymoon').default(false),
  noTransferNeeded: boolean('noTransferNeeded').default(false),
  // Guest arranges that leg themselves — we owe no boat, and it is not an open task.
  // Kept per direction, because a guest often books only one of the two.
  ownArrivalTransfer: boolean('ownArrivalTransfer').default(false),
  ownDepartureTransfer: boolean('ownDepartureTransfer').default(false),
  // Hour the guest says they will reach the lodge under their own steam, "HH:MM".
  // There is no transfer to derive it from, so reception types it in.
  ownArrivalTime: text('ownArrivalTime'),
  mealPlan: text('mealPlan'), // B = Breakfast, HB = Half Board, FB = Full Board
  // How many of the party the board actually covers. A booking is one row, but the
  // guests in it need not have bought the same thing: one may take half board for
  // the whole stay while the other pays for the odd meal. NULL means "everyone",
  // which is how every existing booking reads, so this changes nothing until set.
  mealPlanPax: integer('mealPlanPax'),
  mealPlanPrepaid: boolean('mealPlanPrepaid').default(false), // true if meal plan was paid in advance with reservation
  mealPlanPaymentStatus: text('mealPlanPaymentStatus').default('UNPAID'), // PAID or UNPAID
  mealPlanSnack: boolean('mealPlanSnack').default(false), // guest also gets a snack — kitchen needs to know
  agencyCommission: decimal('agencyCommission', { precision: 10, scale: 2 }).default('0'), // Commission paid to agency in EUR
  checkedInAt: timestamp('checkedInAt'),
  checkedOutAt: timestamp('checkedOutAt'),
  notes: text('notes'),
  extensionNote: text('extensionNote'), // Guest-facing note about stay extensions (shown on invoice)
  excludeFromTaxes: boolean('excludeFromTaxes').default(false), // Izključi to rezervacijo iz obračuna taks
  excludeFromBar: boolean('excludeFromBar').default(false), // Ne prikaži v bar dobavnicah (fakturira se na drug bungalov)
  showNoteOnCard: boolean('showNoteOnCard').default(true), // Ali se opomba prikaže na kartici bungalova
  totalAmount: decimal('totalAmount', { precision: 10, scale: 2 }),
  amountPaid: decimal('amountPaid', { precision: 10, scale: 2 }).default('0'),
  currency: text('currency').default('EUR'),
  groupId: text('groupId'), // Links multiple reservations together (same group/family)
  isMainReservation: boolean('isMainReservation').default(false), // Main reservation in a group
  sharedInvoice: boolean('sharedInvoice').default(false), // If true, group uses single shared invoice on main reservation
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Payments tracking
export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId').notNull().references(() => reservations.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('EUR'),
  method: text('method').notNull(), // 'card', 'transfer', 'orange_money', 'cash'
  paidAt: date('paidAt').notNull(),
  notes: text('notes'),
  // Pri načinu Orange Money: koliko Ar je dejansko prišlo na OM denarnico.
  // omLedgerId povezuje priliv v orange_money_transactions (izbriše se ob brisanju plačila).
  omAmountAr: integer('omAmountAr'),
  omLedgerId: text('omLedgerId'),
  // Pri načinu Gotovina: podjetje (tourism/sarl) in povezava na priliv v blagajni
  // (bank_cash_income), ki se izbriše ob brisanju plačila.
  cashCompany: text('cashCompany'),
  cashLedgerId: text('cashLedgerId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const transfers = pgTable('transfers', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId')
    .notNull()
    .references(() => reservations.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'arrival' or 'departure'
  route: text('route'),
  time: text('time'),
  flightNumber: text('flightNumber'),
  flightTime: text('flightTime'),
  pickupDate: date('pickupDate'),
  // Where the guest is collected (hotel, airport terminal, port…). Free text, because
  // it is what the guest told us, not a value we can pick from a list. Shown on the voucher.
  pickupPoint: text('pickupPoint'),
  pax: integer('pax').default(1),
  notes: text('notes'),
  boatId: text('boatId').references(() => boats.id),
  boatPortTime: text('boatPortTime'),
  hermanAirportTime: text('hermanAirportTime'),
  hermanRouteId: text('hermanRouteId').references(() => routes.id),
  taxiBoatId: text('taxiBoatId'), // kateri taksist vozi avto krak (taxi-herman | taxi-amad); null = Herman
  dilipOrderedAt: timestamp('dilipOrderedAt'),
  hermanOrderedAt: timestamp('hermanOrderedAt'),
  guestPrice: decimal('guestPrice', { precision: 10, scale: 2 }).default('0'),
  paymentStatus: text('paymentStatus').default('UNPAID'), // 'PAID', 'UNPAID', 'PREPAID'
  paidMethod: text('paidMethod'), // 'card' | 'cash' | 'transfer' — how the guest paid (for invoice)
  paidDate: text('paidDate'), // YYYY-MM-DD when the guest paid (for invoice)
  executed: boolean('executed').default(false),
  executedAt: timestamp('executedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId')
    .notNull()
    .references(() => reservations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  qty: integer('qty').notNull().default(1),
  priceAr: integer('priceAr').notNull().default(0),
  refPriceAr: integer('refPriceAr'), // Real price kept for display even when PAID (priceAr becomes 0 for evidence). Shown on invoice as "(Paid)". Does NOT affect totals.
  costAr: integer('costAr'), // Manual supplier cost for external items (e.g. chartered excursions like Catameran that have no excursion_booking). Used by statistics only.
  paymentStatus: text('paymentStatus').default('UNPAID'),
  paidMethod: text('paidMethod'), // 'card' | 'cash' | 'transfer' — how the guest paid (for invoice)
  paidDate: text('paidDate'), // YYYY-MM-DD when the guest paid (for invoice)
  isFree: boolean('isFree').default(false), // true when staff marked the item complimentary (On House) -> not billed
  eventDate: text('eventDate'), // Date when the item/service occurs (for excursions, transfers)
  addedBy: text('addedBy'), // who added this item at reception (e.g. 'Urska')
  dilipOrderedAt: timestamp('dilipOrderedAt'), // reception ad-hoc transfer: boat ordered from Dilip
  hermanOrderedAt: timestamp('hermanOrderedAt'), // reception ad-hoc transfer: Herman taxi ordered
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  })

export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// Per-reservation invoice discounts (e.g. discount on stay, free dinner)
export const invoiceDiscounts = pgTable('invoice_discounts', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId')
    .notNull()
    .references(() => reservations.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('stay'), // 'stay' | 'item'
  label: text('label').notNull(),
  amountAr: integer('amountAr').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Transfer Pricing tables -----------------------------------------------

export const boats = pgTable('boats', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  engine: text('engine').notNull(),
  maxPax: integer('maxPax').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const routes = pgTable('routes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('transfer'), // 'transfer' or 'excursion'
  baseRouteId: text('baseRouteId'), // For composite routes like Airport = Port Nosy Be + taxi
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const supplements = pgTable('supplements', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceAr: integer('priceAr').notNull().default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const routeSupplements = pgTable('route_supplements', {
  id: text('id').primaryKey(),
  routeId: text('routeId').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  supplementId: text('supplementId').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const supplierPricing = pgTable('supplier_pricing', {
  id: text('id').primaryKey(),
  boatId: text('boatId').notNull().references(() => boats.id, { onDelete: 'cascade' }),
  routeId: text('routeId').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  priceAr: integer('priceAr').notNull().default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const sellingPricing = pgTable('selling_pricing', {
  id: text('id').primaryKey(),
  boatId: text('boatId').notNull().references(() => boats.id, { onDelete: 'cascade' }),
  routeId: text('routeId').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  pricePax1: decimal('pricePax1', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax2: decimal('pricePax2', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax3: decimal('pricePax3', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax4: decimal('pricePax4', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax5: decimal('pricePax5', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax6: decimal('pricePax6', { precision: 10, scale: 2 }).notNull().default('0'),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Excursion Pricing tables -----------------------------------------------

export const excursions = pgTable('excursions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('imageUrl'),
  guidePriceAr: integer('guidePriceAr').notNull().default(0),
  entranceFeeAr: integer('entranceFeeAr').notNull().default(0),
  lunchPriceAr: integer('lunchPriceAr').notNull().default(0),
  active: boolean('active').default(true),
  duplicatedAt: timestamp('duplicatedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  })
  
  export const excursionPricing = pgTable('excursion_pricing', {
  id: text('id').primaryKey(),
  excursionId: text('excursionId').notNull().references(() => excursions.id, { onDelete: 'cascade' }),
  boatId: text('boatId').notNull().references(() => boats.id, { onDelete: 'cascade' }),
  priceAr: integer('priceAr').notNull().default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const excursionSellingPricing = pgTable('excursion_selling_pricing', {
  id: text('id').primaryKey(),
  excursionId: text('excursionId').notNull().references(() => excursions.id, { onDelete: 'cascade' }),
  boatId: text('boatId').notNull().references(() => boats.id, { onDelete: 'cascade' }),
  pricePax1: decimal('pricePax1', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax2: decimal('pricePax2', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax3: decimal('pricePax3', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax4: decimal('pricePax4', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax5: decimal('pricePax5', { precision: 10, scale: 2 }).notNull().default('0'),
  pricePax6: decimal('pricePax6', { precision: 10, scale: 2 }).notNull().default('0'),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Lunch Providers (for excursions) -------------------

export const lunchProviders = pgTable('lunch_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location'),
  pricePerPersonAr: integer('pricePerPersonAr').notNull().default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Scheduled Excursions (Fanja's planned trips) -------------------

export const scheduledExcursions = pgTable('scheduled_excursions', {
  id: text('id').primaryKey(),
  date: date('date').notNull(),
  excursionType: text('excursionType').notNull(), // bivouac, tanikely-sakatia, mitsio, safari-iranja
  isOption: boolean('isOption').default(false),
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Excursion Bookings (guest excursion reservations) -------------------

export const excursionBookings = pgTable('excursion_bookings', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId').notNull(),
  excursionId: text('excursionId').notNull(),
  boatId: text('boatId'),
  date: date('date'),
  pax: integer('pax').notNull().default(1),
  guestPrice: decimal('guestPrice', { precision: 10, scale: 2 }).notNull().default('0'),
  entranceFee: decimal('entranceFee', { precision: 10, scale: 2 }).notNull().default('0'),
  // Dodatna vstopnina (npr. Maki park), znesek v Ar za celotno rezervacijo + oznaka. Velja samo za posamezni booking.
  extraEntranceAr: integer('extraEntranceAr').default(0),
  extraEntranceLabel: text('extraEntranceLabel'),
  lunchPrice: decimal('lunchPrice', { precision: 10, scale: 2 }).notNull().default('0'),
  lunchPax: integer('lunchPax').notNull().default(0),
  lunchProviderId: text('lunchProviderId'),
  paymentStatus: text('paymentStatus').default('UNPAID'),
  paidMethod: text('paidMethod'), // 'card' | 'cash' | 'transfer' — how the guest paid (for invoice)
  paidDate: text('paidDate'), // YYYY-MM-DD when the guest paid (for invoice)
  notes: text('notes'),
  dilipOrderedAt: timestamp('dilipOrderedAt'),
  groupId: text('groupId'),
  groupPax: integer('groupPax'),
  // Lifecycle: 'ACTIVE' (default) or 'CANCELLED' (e.g. guest illness → converted to credit).
  // Cancelled bookings drop out of the operational lists but stay in the guest history.
  status: text('status').notNull().default('ACTIVE'),
  cancelledAt: timestamp('cancelledAt'),
  cancelReason: text('cancelReason'),
  // Plačilo Fanji (ponudniku izleta): kdaj, kako in — pri gotovini — iz katere blagajne.
  // fanjaLedgerId povezuje vknjižbo (gotovinski strošek ali OM transakcijo), da jo ob preklicu izbrišemo.
  fanjaPaidAt: text('fanjaPaidAt'), // YYYY-MM-DD
  fanjaPaidMethod: text('fanjaPaidMethod'), // 'cash' | 'orange'
  fanjaPaidCompany: text('fanjaPaidCompany'), // 'tourism' | 'sarl' | null (samo pri gotovini)
  fanjaLedgerId: text('fanjaLedgerId'),
  fanjaPaidAmountAr: integer('fanjaPaidAmountAr'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  })
  
  // --- Bentral Reservations (imported from channel manager) -------------------

export const bentralReservations = pgTable('bentral_reservations', {
  id: text('id').primaryKey(),
  externalId: text('externalId').notNull().unique(),
  status: text('status').notNull(),
  source: text('source'),
  guestName: text('guestName').notNull(),
  country: text('country'),
  checkIn: date('checkIn').notNull(),
  checkOut: date('checkOut').notNull(),
  nights: integer('nights').notNull(),
  adults: integer('adults').notNull().default(1),
  children: integer('children').notNull().default(0),
  childrenAges: text('childrenAges'),
  units: text('units'),
  currency: text('currency').default('EUR'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  guestNotes: text('guestNotes'),
  ownNotes: text('ownNotes'),
  transferred: boolean('transferred').default(false),
  reservationId: text('reservationId'),
  importedAt: timestamp('importedAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  active: boolean('active').default(true),
})

// --- Sent Emails Archive ---------------------------------------------------

export const sentEmails = pgTable('sent_emails', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId').references(() => reservations.id, { onDelete: 'set null' }),
  transferId: text('transferId').references(() => transfers.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'transfer_voucher', 'confirmation', etc.
  recipientEmail: text('recipientEmail').notNull(),
  recipientName: text('recipientName'),
  subject: text('subject').notNull(),
  sentAt: timestamp('sentAt').notNull().defaultNow(),
  sentBy: text('sentBy'), // User who sent it
  gmailMessageId: text('gmailMessageId'), // Gmail message ID for reference
  status: text('status').default('sent'), // 'sent', 'failed', 'bounced'
  metadata: text('metadata'), // JSON with additional data (transfer details, etc.)
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Staff / Delavci -------------------------------------------------------

export const staff = pgTable('staff', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  pin: text('pin').notNull(), // 4-digit PIN for login
  role: text('role').notNull().default('barman'), // 'admin', 'barman', 'receptionist'
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Products / Katalog artiklov -------------------------------------------
  
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'drink', 'food', 'excursion', 'product', 'service'
  costCategory: text('costCategory').default('pijaca'), // pijaca, prehrana, wellness, ostalo - za statistiko
  priceAr: integer('priceAr').notNull().default(0), // Price in Ariary
  costAr: integer('costAr'), // Purchase/supplier cost per unit in Ariary (e.g. chocolate bought 15000, sold 25000). Used by statistics for exact profit; falls back to category % when null.
  priceEur: decimal('priceEur', { precision: 10, scale: 2 }), // Optional EUR price
  unit: text('unit').default('kos'), // 'kos', 'liter', 'kg', etc.
  active: boolean('active').default(true),
  editablePrice: boolean('editablePrice').default(false), // if true, price can be edited each time the item is added (e.g. staff gratuity/tip)
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Delivery Notes / Dobavnice --------------------------------------------

export const deliveryNotes = pgTable('delivery_notes', {
  id: text('id').primaryKey(),
  reservationId: text('reservationId').references(() => reservations.id, { onDelete: 'set null' }),
  bungalow: text('bungalow').notNull(),
  guestName: text('guestName'),
  date: date('date').notNull(), // The day this delivery note is for
  status: text('status').notNull().default('open'), // 'open', 'closed'
  closedAt: timestamp('closedAt'),
  closedBy: text('closedBy').references(() => staff.id),
  totalAr: integer('totalAr').default(0),
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Delivery Note Items / Vnosi na dobavnico ------------------------------
  
export const deliveryNoteItems = pgTable('delivery_note_items', {
  id: text('id').primaryKey(),
  deliveryNoteId: text('deliveryNoteId').notNull().references(() => deliveryNotes.id, { onDelete: 'cascade' }),
  productId: text('productId').references(() => products.id, { onDelete: 'set null' }),
  productName: text('productName').notNull(), // Store name in case product is deleted
  category: text('category').notNull(),
  costCategory: text('costCategory').default('pijaca'), // pijaca, prehrana, wellness, ostalo
  quantity: integer('quantity').notNull().default(1),
  priceAr: integer('priceAr').notNull(), // Price at time of sale
  totalAr: integer('totalAr').notNull(), // quantity * priceAr (0 when covered by meal plan)
  coveredByMealPlan: boolean('coveredByMealPlan').default(false), // true when this meal is included in the guest's meal plan (B/HB/FB) -> not billed
  isFree: boolean('isFree').default(false), // true when staff marked the item complimentary (na racun hise) -> not billed
  staffId: text('staffId').references(() => staff.id, { onDelete: 'set null' }),
  staffName: text('staffName'), // Store name in case staff is deleted
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Invoices / Racuni -----------------------------------------------------

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoiceNumber').notNull().unique(), // e.g., "INV-2024-001"
  reservationId: text('reservationId').references(() => reservations.id, { onDelete: 'set null' }),
  guestName: text('guestName').notNull(),
  bungalow: text('bungalow').notNull(),
  arrivalDate: date('arrivalDate'),
  departureDate: date('departureDate'),
  totalAr: integer('totalAr').notNull().default(0),
  totalEur: decimal('totalEur', { precision: 10, scale: 2 }),
  exchangeRate: decimal('exchangeRate', { precision: 10, scale: 2 }), // EUR to AR rate used
  status: text('status').notNull().default('draft'), // 'draft', 'issued', 'paid', 'cancelled'
  paidAt: timestamp('paidAt'),
  paymentMethod: text('paymentMethod'), // 'cash', 'card', 'transfer'
  notes: text('notes'),
  createdBy: text('createdBy').references(() => staff.id),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Invoice Items (snapshot of delivery note items) -----------------------

export const invoiceItems = pgTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoiceId').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  deliveryNoteId: text('deliveryNoteId').references(() => deliveryNotes.id, { onDelete: 'set null' }),
  deliveryNoteDate: date('deliveryNoteDate'),
  productName: text('productName').notNull(),
  category: text('category').notNull(),
  quantity: integer('quantity').notNull(),
  priceAr: integer('priceAr').notNull(),
  totalAr: integer('totalAr').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Cost Settings / Nastavitve stroškov -----------------------------------

export const costSettings = pgTable('cost_settings', {
  id: text('id').primaryKey(),
  category: text('category').notNull().unique(), // 'bar_pijaca', 'bar_prehrana', 'wellness', 'ostalo'
  costType: text('costType').notNull(), // 'percentage' or 'fixed'
  value: decimal('value', { precision: 10, scale: 2 }).notNull(), // % ali fiksna cena v EUR
  description: text('description'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- Staff Salaries / Plače osebja -----------------------------------------

export const staffSalaries = pgTable('staff_salaries', {
  id: text('id').primaryKey(),
  staffType: text('staffType').notNull(), // 'gardener', 'housekeeper', etc.
  staffName: text('staffName').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12
  salary: decimal('salary', { precision: 10, scale: 2 }).notNull(), // v EUR
  allocateTo: text('allocateTo').notNull().default('accommodation'), // 'accommodation', 'bar', 'general'
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Marketing Expenses / Stroški marketinga -------------------------------

export const marketingExpenses = pgTable('marketing_expenses', {
  id: text('id').primaryKey(),
  category: text('category').notNull().default('marketing'), // 'marketing' | 'booking' | 'optimaplus'
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12 (izpeljano iz date)
  date: date('date'), // dejanski datum stroska
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // v EUR
  paymentMethod: text('paymentMethod'), // 'cash' | 'orange_money' | 'transfer' | 'in_kind'
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Vračila dolga Hnatura d.o.o. (opravljena nakazila, ki znižujejo dolg)
export const hnaturaRepayments = pgTable('hnatura_repayments', {
  id: text('id').primaryKey(),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12 (izpeljano iz date)
  date: date('date'),
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // v EUR
  cashExpenseId: text('cashExpenseId'), // če je bilo plačano iz gotovinske blagajne (bank_cash_expenses.id)
  cashCompany: text('cashCompany'), // podjetje blagajne (tourism|sarl)
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Osnovna sredstva (fixed assets) — knjižijo se posebej; mesečni strošek je amortizacija.
// Amortizacijska stopnja (letni %) se določi za vsako sredstvo posebej.
export const fixedAssets = pgTable('fixed_assets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  purchaseDate: date('purchaseDate').notNull(), // datum nabave (določa začetek amortizacije)
  amountAr: decimal('amountAr', { precision: 16, scale: 2 }).notNull(), // nabavna vrednost v Ar (osnova)
  amountEur: decimal('amountEur', { precision: 12, scale: 2 }).notNull(), // preračun v EUR ob nabavi (za kalkulacije)
  annualRatePct: decimal('annualRatePct', { precision: 6, scale: 2 }).notNull(), // letna amortizacijska stopnja v %
  receiptId: text('receiptId'), // če je knjiženo iz računa (stroski arhiv) — za značko "osnovno sredstvo"
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  })

export const housekeepingSchedule = pgTable('housekeeping_schedule', {
  id: text('id').primaryKey(),
  date: date('date').notNull(), // YYYY-MM-DD
  staffName: text('staffName').notNull(), // 'Eniki', 'Felicia', 'Christaline'
  shift: text('shift').notNull(), // 'MORNING' (6-12), 'AFTERNOON' (12-18), 'OFF'
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  })

// --- Plačila dobaviteljem prevoza (Dilip čoln / Herman avto) iz pending transferjev -----
// Skupna evidenca za OBE vrsti kartic (recepcija = order_item, prihod/odhod = transfer).
// refKey enolično določa kartico+dobavitelja: 'reception:<orderId>:<supplier>' ali
// 'transfer:<reservationId>:<type>:<supplier>'. Ena vknjižba (gotovina ali OM) na zapis;
// ledgerId povezuje vknji��bo, da jo ob preklicu izbrišemo.
export const supplierPayments = pgTable('supplier_payments', {
  id: text('id').primaryKey(),
  refKey: text('refKey').notNull(),
  supplier: text('supplier').notNull(), // 'dilip' | 'herman'
  paidAt: text('paidAt'), // YYYY-MM-DD
  method: text('method'), // 'cash' | 'orange'
  company: text('company'), // 'tourism' | 'sarl' | null (samo pri gotovini)
  ledgerId: text('ledgerId'),
  amountAr: integer('amountAr'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  })

// --- AI-generirani osnutki odgovorov na vprašanja gosta -------------------------------
// Recepcija prilepi gostovo sporočilo, AI sestavi osnutek odgovora iz podatkov programa.
// Shrani se zadnji urejeni odgovor, da lahko dobi javno povezavo (kot vaučer) in ga
// pošlje gostu. Ena aktivna vrstica na rezervacijo (isti id = reservationId).
export const guestReplies = pgTable('guest_replies', {
  id: text('id').primaryKey(), // = reservationId (ena na rezervacijo)
  reservationId: text('reservationId').notNull(),
  guestMessage: text('guestMessage'), // prilepljeno gostovo sporočilo
  replyText: text('replyText').notNull(), // urejeno besedilo odgovora
  internalNotes: text('internalNotes'), // interni zapis (čoln + kje kosilo) — SAMO za recepcijo, NE gostu
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  })
