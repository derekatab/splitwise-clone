/**
 * Creates a trip whose admin (creator) is someone other than the person running the script,
 * then invites that admin by email through the deployed app's admin invite API.
 *
 * Usage:
 *   node scripts/createTripWithAdmin.mjs --name "Beijing Boys" --admin-email someone@example.com --admin-name "Faham"
 *
 * Options:
 *   --description "text"   Optional trip description
 *   --no-invite            Create the trip but do not send the invite email
 *   --force                Create even if a trip with the same name already exists for this admin
 *
 * Requires in .env: DATABASE_URL / PRISMA_DATABASE_URL, NEXT_PUBLIC_APP_URL, ADMIN_SECRET_KEY
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  const adminEmail = typeof args['admin-email'] === 'string' ? args['admin-email'].trim().toLowerCase() : '';
  const adminName = typeof args['admin-name'] === 'string' ? args['admin-name'].trim() : '';
  const description = typeof args.description === 'string' ? args.description.trim() : null;

  if (!name || !adminEmail || !adminName) {
    console.error('Usage: node scripts/createTripWithAdmin.mjs --name "Trip name" --admin-email email --admin-name "Name" [--description "..."] [--no-invite] [--force]');
    process.exit(1);
  }

  const prisma = new PrismaClient({ accelerateUrl: process.env.PRISMA_DATABASE_URL });

  try {
    // 1. Find or create the admin user
    let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (admin) {
      console.log(`Using existing user ${admin.name} <${admin.email}> (${admin.id})`);
    } else {
      admin = await prisma.user.create({ data: { email: adminEmail, name: adminName } });
      console.log(`Created user ${admin.name} <${admin.email}> (${admin.id})`);
    }

    // 2. Guard against accidental duplicates
    const existingTrip = await prisma.trip.findFirst({
      where: { createdBy: admin.id, name: { equals: name, mode: 'insensitive' } },
    });
    if (existingTrip && !args.force) {
      console.error(`A trip named "${existingTrip.name}" (${existingTrip.id}) already exists for this admin. Re-run with --force to create another.`);
      process.exit(2);
    }

    // 3. Create the trip with the admin as creator + first member (mirrors /api/trips/create)
    const trip = await prisma.trip.create({
      data: { name, description, createdBy: admin.id },
    });
    await prisma.tripMember.create({ data: { tripId: trip.id, userId: admin.id } });
    await prisma.auditTrailEntry.create({
      data: {
        tripId: trip.id,
        userId: admin.id,
        action: 'trip_created',
        details: { name, description, createdVia: 'scripts/createTripWithAdmin.mjs' },
      },
    });
    console.log(`Created trip "${trip.name}" (${trip.id}) with admin ${admin.name}`);

    // 4. Invite the admin through the deployed app so the email uses the app's own template/SMTP
    if (args['no-invite']) {
      console.log('Skipping invite (--no-invite)');
    } else {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
      const adminKey = process.env.ADMIN_SECRET_KEY;
      if (!appUrl || !adminKey) {
        console.error('NEXT_PUBLIC_APP_URL and ADMIN_SECRET_KEY must be set to send the invite.');
        process.exitCode = 3;
      } else {
        const res = await fetch(`${appUrl}/api/admin/invites/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify({ tripId: trip.id, email: adminEmail }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error(`Invite failed (${res.status}):`, data.error || data, data.details || '');
          process.exitCode = 3;
        } else {
          console.log(`Invite sent to ${adminEmail} (invite ${data.inviteId})`);
        }
      }
    }

    console.log('\nSummary');
    console.log(`  Trip:  ${trip.name} (${trip.id})`);
    console.log(`  Admin: ${admin.name} <${admin.email}> (${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
