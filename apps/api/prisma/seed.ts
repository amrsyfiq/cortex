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
import OpenAI from 'openai';
import { GEMINI_BASE_URL, embedText } from '../src/documents/embedding.util';

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

  // --- RAG demo data: org documents (adviser notes) with embeddings ---------
  // These let the AI assistant answer questions about the CONTENT of notes via
  // semantic search (the search_documents tool), not just the member list.
  // Embeddings need the Gemini key, so we skip this block cleanly without one.
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn(
      'GEMINI_API_KEY not set — skipping document seeding (semantic search needs embeddings).',
    );
  } else {
    const ai = new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL });

    const docs = [
      {
        org: acme,
        title: 'Client review — Margaret Chen',
        content:
          'Margaret Chen, age 58, wants to retire at 60. Risk-averse — prefers ' +
          'capital protection over growth. Pension pot is about £450,000. Main ' +
          'concern is funding potential care costs for her elderly mother. Agreed ' +
          'to shift towards lower-volatility funds and review again in 12 months.',
      },
      {
        org: acme,
        title: 'Client review — David Okoro',
        content:
          'David Okoro, age 31, software engineer. High risk tolerance, comfortable ' +
          'with volatility. Wants to maximise his Stocks & Shares ISA allowance and ' +
          'is keen on technology funds. Saving for a house deposit in roughly three ' +
          'years, so we ring-fenced that portion in a lower-risk cash account.',
      },
      {
        org: acme,
        title: 'Compliance note — annual suitability reviews',
        content:
          'Firm policy: every advised client must have a documented annual ' +
          'suitability review. Each review must record the client\'s current ' +
          'attitude to risk, capacity for loss, and any change in circumstances. ' +
          'Reviews older than 14 months are flagged as overdue for compliance.',
      },
      {
        org: globex,
        title: 'Client review — the Hartley family',
        content:
          'The Hartleys are planning their estate. Combined assets around £1.2m, ' +
          'including the family home. Three adult children. Priority is reducing ' +
          'inheritance tax exposure. Discussed using trusts and making use of the ' +
          'annual gifting allowance. Referred to a tax specialist for the trust setup.',
      },
      {
        org: globex,
        title: 'Internal note — Q2 fund changes',
        content:
          'In Q2 we moved affected clients out of the Meridian Growth fund into the ' +
          'Lowland Balanced fund, driven by a rise in Meridian\'s ongoing charges. ' +
          'All impacted clients were notified in writing and consent recorded.',
      },
    ];

    // Idempotent: clear this demo\'s docs for these orgs, then re-create with fresh embeddings.
    await prisma.document.deleteMany({
      where: { organizationId: { in: [acme.id, globex.id] } },
    });

    for (const doc of docs) {
      const embedding = await embedText(ai, doc.content);
      await prisma.document.create({
        data: {
          organizationId: doc.org.id,
          title: doc.title,
          content: doc.content,
          embedding,
        },
      });
    }
    console.log(`Seeded ${docs.length} documents with embeddings.`);
  }

  console.log('Seed complete. Log in with alice@example.com / password123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
