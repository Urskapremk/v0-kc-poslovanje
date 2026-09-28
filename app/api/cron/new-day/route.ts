import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deliveryNotes, reservations } from '@/lib/db/schema'
import { eq, isNull, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// This cron runs at 00:00 Madagascar time (21:00 UTC) every day
// It closes all open delivery notes and creates new ones for the next day
export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get Madagascar date (UTC+3)
    const now = new Date()
    const madagascarTime = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const today = madagascarTime.toISOString().split('T')[0]
    
    // Find all active reservations (checked in but not checked out)
    const activeReservations = await db.query.reservations.findMany({
      where: and(
        isNull(reservations.checkedOutAt),
        // Only those who are checked in
        eq(reservations.checkedInAt, reservations.checkedInAt) // This means checkedInAt is not null
      )
    })
    
    // Filter to only checked-in reservations
    const checkedInReservations = activeReservations.filter(r => r.checkedInAt !== null)
    
    let closedCount = 0
    let createdCount = 0
    
    for (const reservation of checkedInReservations) {
      // Find open delivery note for this reservation
      const openNote = await db.query.deliveryNotes.findFirst({
        where: and(
          eq(deliveryNotes.reservationId, reservation.id),
          eq(deliveryNotes.status, 'open')
        )
      })
      
      if (openNote) {
        // Close the open note
        await db.update(deliveryNotes)
          .set({ 
            status: 'closed',
            closedAt: new Date()
          })
          .where(eq(deliveryNotes.id, openNote.id))
        closedCount++
      }
      
      // Check if there's already a note for today
      const existingTodayNote = await db.query.deliveryNotes.findFirst({
        where: and(
          eq(deliveryNotes.reservationId, reservation.id),
          eq(deliveryNotes.date, today)
        )
      })
      
      if (!existingTodayNote) {
        // Create new delivery note for today
        await db.insert(deliveryNotes).values({
          id: nanoid(),
          reservationId: reservation.id,
          date: today,
          status: 'open',
          totalAr: 0
        })
        createdCount++
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      date: today,
      closedNotes: closedCount,
      createdNotes: createdCount,
      activeReservations: checkedInReservations.length
    })
  } catch (error) {
    console.error('Cron new-day error:', error)
    return NextResponse.json({ error: 'Failed to process new day' }, { status: 500 })
  }
}
