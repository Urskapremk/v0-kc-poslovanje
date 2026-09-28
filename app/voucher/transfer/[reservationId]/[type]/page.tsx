import { getTransferVoucherEmailPreview } from "@/app/actions/transfer-voucher-email"
import { notFound } from "next/navigation"

export default async function TransferVoucherPage({ params }: { params: Promise<{ reservationId: string; type: string }> }) {
  const { reservationId, type } = await params

  if (type !== 'arrival' && type !== 'departure') {
    notFound()
  }

  const result = await getTransferVoucherEmailPreview(reservationId, type as 'arrival' | 'departure')

  if (!result.html) {
    notFound()
  }

  // Render the exact same branded (dark) voucher used for the email and print,
  // inside an isolated iframe so it looks identical on a phone.
  return (
    <div style={{ minHeight: '100vh', background: '#0a2029' }}>
      <iframe
        title="Transfer Voucher"
        srcDoc={result.html}
        style={{ width: '100%', minHeight: '100vh', border: 0, display: 'block' }}
      />
    </div>
  )
}
