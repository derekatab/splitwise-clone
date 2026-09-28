import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTripAdmin } from '@/lib/auth';
import { createAndSendTripInvite, isValidEmail, normalizeEmail } from '@/lib/invites';
import { logAuditTrailEntry } from '@/lib/utils/auditTrail';

type RouteParams = { params: Promise<{ tripId: string; userId: string }> };

/**
 * PATCH /api/trips/[tripId]/members/[userId]
 * Body: { name?: string; email?: string }
 *
 * Trip admin only. Fixes the name or attaches/changes the email of a member who has
 * not signed in yet (no device). Once someone has signed in they own their profile.
 * Setting a new email sends that person an invite.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { tripId, userId } = await params;
    const auth = await requireTripAdmin(request, tripId);
    if (!auth.ok) return auth.response;
    const { user: admin, trip } = auth;

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
      include: { user: { include: { _count: { select: { devices: true } } } } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const target = membership.user;
    if (target._count.devices > 0) {
      return NextResponse.json(
        { error: `${target.name} has already signed in and manages their own profile. You can resend an invite or remove them.` },
        { status: 409 }
      );
    }

    const body = await request.json();
    const data: { name?: string; email?: string } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      if (name !== target.name) data.name = name;
    }

    const email = normalizeEmail(body.email);
    if (email && email !== target.email) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== target.id) {
        return NextResponse.json(
          { error: `${email} already belongs to ${taken.name || 'another account'}. Remove this member and add them by email instead.` },
          { status: 409 }
        );
      }
      data.email = email;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ member: membership, inviteSent: false, inviteError: null, success: true });
    }

    const updatedUser = await prisma.user.update({ where: { id: target.id }, data });

    let inviteSent = false;
    let inviteError: string | null = null;
    if (data.email) {
      try {
        await createAndSendTripInvite(tripId, data.email, trip.name);
        inviteSent = true;
      } catch (err) {
        console.error('Invite email failed:', err);
        inviteError = 'Saved, but the invite email could not be sent. Use "Resend invite" to try again.';
      }
    }

    await logAuditTrailEntry(tripId, admin.id, 'member_updated', {
      memberUserId: target.id,
      name: updatedUser.name,
      email: updatedUser.email,
      inviteSent,
    });

    return NextResponse.json({
      member: { ...membership, user: updatedUser },
      inviteSent,
      inviteError,
      success: true,
    });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

/**
 * DELETE /api/trips/[tripId]/members/[userId]
 *
 * Trip admin only. Removes a member from the trip. Refused when the member is part of
 * any expense in this trip, because balances would no longer add up. Placeholder
 * accounts (never signed in, in no other trip) are deleted entirely.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { tripId, userId } = await params;
    const auth = await requireTripAdmin(request, tripId);
    if (!auth.ok) return auth.response;
    const { user: admin } = auth;

    if (userId === admin.id) {
      return NextResponse.json({ error: 'The trip admin cannot be removed from the trip' }, { status: 400 });
    }

    const membership = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
      include: { user: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    const target = membership.user;

    const [paidCount, splitCount] = await Promise.all([
      prisma.expense.count({ where: { tripId, createdBy: userId } }),
      prisma.expenseSplit.count({ where: { userId, expense: { tripId } } }),
    ]);
    const involvement = paidCount + splitCount;
    if (involvement > 0) {
      return NextResponse.json(
        { error: `${target.name} is part of ${involvement} expense${involvement === 1 ? '' : 's'} in this trip. Delete those expenses first, then remove the member.` },
        { status: 409 }
      );
    }

    await prisma.tripMember.delete({ where: { id: membership.id } });

    if (target.email) {
      await prisma.deviceInvite.deleteMany({
        where: { tripId, email: { equals: target.email, mode: 'insensitive' }, accepted: false },
      });
    }

    // A placeholder account that never signed in and has no other footprint is deleted outright.
    const [deviceCount, membershipCount, splitTotal, expenseTotal, auditCount] = await Promise.all([
      prisma.device.count({ where: { userId } }),
      prisma.tripMember.count({ where: { userId } }),
      prisma.expenseSplit.count({ where: { userId } }),
      prisma.expense.count({ where: { createdBy: userId } }),
      prisma.auditTrailEntry.count({ where: { userId } }),
    ]);
    let userDeleted = false;
    if (deviceCount === 0 && membershipCount === 0 && splitTotal === 0 && expenseTotal === 0 && auditCount === 0) {
      await prisma.user.delete({ where: { id: userId } });
      userDeleted = true;
    }

    await logAuditTrailEntry(tripId, admin.id, 'member_removed', {
      memberUserId: userId,
      name: target.name,
      email: target.email,
      userDeleted,
    });

    return NextResponse.json({ success: true, userDeleted });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
