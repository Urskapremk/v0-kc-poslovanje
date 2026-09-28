import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()
  
  if (!pin || pin.length !== 4) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
  }
  
  const staffMember = await db.query.staff.findFirst({
    where: and(eq(staff.pin, pin), eq(staff.active, true))
  })
  
  if (!staffMember) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }
  
  // Zabeleži uspešno prijavo (da lastnica vidi, kdo in kdaj se prijavi v blagajno)
  try {
    const loginId = `slog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.execute(sql`
      INSERT INTO staff_logins (id, "staffId", "staffName", role, "loggedInAt")
      VALUES (${loginId}, ${staffMember.id}, ${staffMember.name}, ${staffMember.role}, now())
    `)
  } catch (logErr) {
    console.log('[v0] staff_logins insert failed:', logErr)
  }

  // Return staff info (in production, you'd set a secure cookie/session)
  return NextResponse.json({
    id: staffMember.id,
    name: staffMember.name,
    role: staffMember.role,
  })
}
