/**
 * Seed script — inserts demo data so the UI has something to show and so you
 * can log in immediately. Run with `pnpm db:seed`.
 *
 * It deliberately models the multi-tenant story:
 *   - Alice OWNs "Acme" and is also a MEMBER of "Globex".
 *   - Bob OWNs "Globex".
 * So when Alice logs in she sees two orgs with two different roles — exactly the
 * scenario the authorization layer exists to handle.
 *
 * Idempotent: it upserts by unique keys, so running it repeatedly is safe.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', name: 'Alice Owner', passwordHash: password },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', name: 'Bob Builder', passwordHash: password },
  });

  const acme = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { name: 'Acme Inc', slug: 'acme' },
  });

  const globex = await prisma.organization.upsert({
    where: { slug: 'globex' },
    update: {},
    create: { name: 'Globex Corp', slug: 'globex' },
  });

  // Memberships — the join-table-with-data that encodes "who can do what where".
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: alice.id, organizationId: acme.id } },
    update: { role: 'OWNER' },
    create: { userId: alice.id, organizationId: acme.id, role: 'OWNER' },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: bob.id, organizationId: globex.id } },
    update: { role: 'OWNER' },
    create: { userId: bob.id, organizationId: globex.id, role: 'OWNER' },
  });

  // Alice is *also* a plain MEMBER of Globex — different role in a different org.
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: alice.id, organizationId: globex.id } },
    update: { role: 'MEMBER' },
    create: { userId: alice.id, organizationId: globex.id, role: 'MEMBER' },
  });

  console.log('Seed complete. Log in with alice@example.com / password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
