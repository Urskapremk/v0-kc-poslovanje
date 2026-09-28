import { generateText, Output } from 'ai'
import { z } from 'zod'

export type ReceiptOcrResult = {
  amount: number | null
  currency: 'EUR' | 'Ar' | null
  date: string | null
  description: string | null
}

const schema = z.object({
  amount: z
    .number()
    .nullable()
    .describe(
      'Končni znesek za plačilo (skupaj / total / TTC / za plačilo) v ORIGINALNI valuti, kot piše na računu. Samo število brez ločil tisočic in brez valute, npr. 232610 ali 232.61. Če ni jasno, null.'
    ),
  currency: z
    .enum(['EUR', 'Ar'])
    .nullable()
    .describe(
      "Valuta zneska: 'EUR' če je v evrih (€, EUR, TTC v EUR), 'Ar' če je v malgaških ariarijih (Ar, Ariary, MGA, Fmg). Večina računov z Madagaskarja je v Ar. Če ni jasno, null."
    ),
  date: z.string().nullable().describe('Datum računa v obliki YYYY-MM-DD. Če ni jasno, null.'),
  description: z
    .string()
    .nullable()
    .describe('Kratek opis (dobavitelj ali vrsta stroška), največ nekaj besed, v slovenščini. Če ni jasno, null.'),
})

// Prebere znesek, valuto, datum in opis z ene ali več slik računa (npr. večstranski račun).
export async function readReceiptFromImages(
  images: { data: Buffer | Uint8Array; mediaType: string }[]
): Promise<ReceiptOcrResult> {
  const { output } = await generateText({
    model: 'google/gemini-2.5-flash',
    output: Output.object({ schema }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'To je fotografija ali skenirani račun (lahko v slovenščini, angleščini, francoščini ali malgaščini), po možnosti na več straneh. ' +
              'Razberi KONČNI znesek za plačilo (išči "Za plačilo", "Skupaj", "Total", "TTC", "Montant", "Net à payer") ' +
              'v ORIGINALNI valuti, kot je natisnjena — NE pretvarjaj. Prepoznaj tudi valuto: EUR (€) ali Ar (Ariary/MGA/Fmg). ' +
              'Večina računov z Madagaskarja je v ariarijih (Ar). Če na računu ni jasnega skupnega zneska, sam SEŠTEJ postavke. ' +
              'Razberi še datum računa in kratek opis (ime dobavitelja ali vrsta stroška). Vrni samo to, kar jasno vidiš.',
          },
          ...images.map((img) => ({ type: 'file' as const, data: img.data, mediaType: img.mediaType })),
        ],
      },
    ],
  })

  return {
    amount: output.amount ?? null,
    currency: output.currency ?? null,
    date: output.date ?? null,
    description: output.description ?? null,
  }
}

export type BankStatementOcrResult = {
  balance: number | null
  currency: 'EUR' | 'Ar' | null
  date: string | null
}

const statementSchema = z.object({
  balance: z
    .number()
    .nullable()
    .describe(
      'KONČNO stanje na računu (nov saldo / Solde au ... / Nouveau solde / Solde final / Closing balance) — številka brez ločil tisočic in brez valute, npr. 32849452 ali 12345.67. To je zadnje/najnovejše stanje na izpisku. Če ni jasno, null.'
    ),
  currency: z
    .enum(['EUR', 'Ar'])
    .nullable()
    .describe("Valuta stanja: 'Ar' za malgaške ariarije (Ar/MGA/Fmg), 'EUR' za evre (€). BMOI izpiski so večinoma v Ar. Če ni jasno, null."),
  date: z
    .string()
    .nullable()
    .describe('Datum končnega stanja (Solde au) v obliki YYYY-MM-DD. Če je naveden le mesec/obdobje, vzemi zadnji datum obdobja. Če ni jasno, null.'),
})

// Prebere KONČNO stanje na računu z ene ali več slik bančnega izpiska (npr. BMOI).
export async function readBankStatementFromImages(
  images: { data: Buffer | Uint8Array; mediaType: string }[]
): Promise<BankStatementOcrResult> {
  const { output } = await generateText({
    model: 'google/gemini-2.5-flash',
    output: Output.object({ schema: statementSchema }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'To je slika bančnega izpiska (npr. BMOI, Madagaskar; v francoščini ali angleščini). ' +
              'Razberi KONČNO / najnovejše stanje na računu — išči "Solde au", "Nouveau solde", "Solde final", "Solde créditeur", "Closing balance", "Nov saldo". ' +
              'Če je več saldov, vzemi ZADNJEGA (najnovejši datum). Vrni znesek v ORIGINALNI valuti, kot je natisnjen — NE pretvarjaj. ' +
              'Prepoznaj valuto (Ar/MGA ali EUR; BMOI je večinoma v Ar) in datum tega stanja. Vrni samo to, kar jasno vidiš.',
          },
          ...images.map((img) => ({ type: 'file' as const, data: img.data, mediaType: img.mediaType })),
        ],
      },
    ],
  })

  return {
    balance: output.balance ?? null,
    currency: output.currency ?? null,
    date: output.date ?? null,
  }
}

export type BankStatementTx = {
  date: string | null
  direction: 'in' | 'out'
  amount: number
  description: string | null
}

export type BankStatementFullResult = {
  balance: number | null
  currency: 'EUR' | 'Ar' | null
  date: string | null
  transactions: BankStatementTx[]
}

const statementFullSchema = z.object({
  balance: z
    .number()
    .nullable()
    .describe(
      'KONČNO / najnovejše stanje na računu (Solde au ... / Nouveau solde / Solde final / Closing balance) — številka brez ločil tisočic in brez valute. Če ni jasno, null.'
    ),
  currency: z
    .enum(['EUR', 'Ar'])
    .nullable()
    .describe("Valuta izpiska: 'Ar' za malgaške ariarije (Ar/MGA/Fmg), 'EUR' za evre (€). BMOI izpiski so večinoma v Ar. Če ni jasno, null."),
  date: z
    .string()
    .nullable()
    .describe('Datum končnega stanja (Solde au) v obliki YYYY-MM-DD. Če ni jasno, null.'),
  transactions: z
    .array(
      z.object({
        date: z.string().nullable().describe('Datum transakcije (stolpec Date / Date operacije) v obliki YYYY-MM-DD. Če je le dan/mesec, dopolni z letom izpiska.'),
        direction: z.enum(['in', 'out']).describe("'out' za bremenitev/odliv (stolpec Débit / Debit), 'in' za dobropis/priliv (stolpec Crédit / Credit)."),
        amount: z.number().describe('Znesek transakcije, pozitivno število brez ločil tisočic in brez valute, npr. 673967 ali 419660.'),
        description: z.string().nullable().describe("Opis operacije (Libellé de l'opération), npr. 'AUTORISATION TPE'. Če ni jasno, null."),
      })
    )
    .describe('Seznam VSEH vrstic transakcij v tabeli izpiska (vsaka vrstica z zneskom v stolpcu Débit ali Crédit). Ne vključi vrstice Total/Skupaj ali vrstice s samim stanjem.'),
})

// Prebere KONČNO stanje IN vse posamezne transakcije z ene ali več slik bančnega izpiska (BMOI).
export async function readBankStatementFullFromImages(
  images: { data: Buffer | Uint8Array; mediaType: string }[]
): Promise<BankStatementFullResult> {
  const { output } = await generateText({
    model: 'google/gemini-2.5-flash',
    output: Output.object({ schema: statementFullSchema }),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'To je slika bančnega izpiska (npr. BMOI, Madagaskar; v francoščini ali angleščini). ' +
              'Naredi DVE stvari: (1) razberi KONČNO / najnovejše stanje na računu ("Solde au", "Nouveau solde", "Closing balance"); ' +
              'če je več saldov, vzemi zadnjega (najnovejši datum). (2) Razberi VSAKO vrstico transakcij iz tabele operacij: ' +
              'datum operacije, znesek in ali je v stolpcu Débit (odliv = "out") ali Crédit (priliv = "in"), ter kratek opis (Libellé). ' +
              'NE vključi vrstice "Total"/"Skupaj" in NE vrstice s samim saldom kot transakcijo. ' +
              'Zneske vrni v ORIGINALNI valuti, kot so natisnjeni — NE pretvarjaj. Prepoznaj valuto (Ar/MGA ali EUR; BMOI je večinoma v Ar). ' +
              'Vrni samo to, kar jasno vidiš.',
          },
          ...images.map((img) => ({ type: 'file' as const, data: img.data, mediaType: img.mediaType })),
        ],
      },
    ],
  })

  return {
    balance: output.balance ?? null,
    currency: output.currency ?? null,
    date: output.date ?? null,
    transactions: (output.transactions ?? []).map((t) => ({
      date: t.date ?? null,
      direction: t.direction === 'out' ? 'out' : 'in',
      amount: Math.abs(Number(t.amount) || 0),
      description: t.description ?? null,
    })),
  }
}
