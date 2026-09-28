import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTripAdmin } from '@/lib/auth';
import { createAndSendTripInvite, isValidEmail, normalizeEmail } from '@/lib/invites';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';

/**
 * POST /api/trips/[tripId]/members
 * Body: { name: string; email?: string }
 *
 * Trip admin only. Adds a member to the trip.
 * - With an email: the person is invited by email (an existing account with that email is reused).
 * - Without an email: a placeholder member is created so they can be included in expense
 *   splits right away. An email can be attached later via PATCH /members/[userId].
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const auth = await requireTripAdmin(request, tripId);
    if (!auth.ok) return auth.response;
    const { user: admin, trip } = auth;

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = normalizeEmail(body.email);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (email && !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    let memberUser = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (memberUser) {
      const existingMembership = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: memberUser.id } },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: `${memberUser.name || email} is already a member of this trip` },
          { status: 409 }
        );
      }
    } else {
      memberUser = await prisma.user.create({ data: { name, email } });
    }

    const membership = await prisma.tripMember.create({
      data: { tripId, userId: memberUser.id },
      include: { user: true },
    });

    let inviteSent = false;
    let inviteError: string | null = null;
    if (email) {
      try {
        await createAndSendTripInvite(tripId, email, trip.name);
        inviteSent = true;
      } catch (err) {
        console.error('Invite email failed:', err);
        inviteError = 'Member added, but the invite email could not be sent. Use "Resend invite" to try again.';
      }
    }

    await logAuditTrailEntry(tripId, admin.id, 'member_added', {
      memberUserId: memberUser.id,
      name: memberUser.name,
      email,
      inviteSent,
    });

    return NextResponse.json(
      { member: membership, inviteSent, inviteError, success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add member error:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
