import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicDocument } from '@saas/contracts';
import OpenAI from 'openai';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { GEMINI_BASE_URL, cosineSimilarity, embedText } from './embedding.util';

/** A document that matched a search, plus which org it's in and how close it was. */
export interface DocumentMatch {
  title: string;
  content: string;
  organization: { name: string; slug: string };
  score: number;
}

/** A document row with its embedding and org, as loaded for ranking. */
interface RankableDocument {
  title: string;
  content: string;
  embedding: number[];
  organization: { name: string; slug: string };
}

/**
 * Semantic search ("RAG") over an organization's documents.
 *
 * The flow: embed the user's QUESTION into a vector, then rank every document in
 * the org by cosine similarity to that vector and return the closest few. The
 * caller (the AI assistant) hands those back to the model as grounding, so it
 * answers from real notes instead of inventing.
 *
 * Like AssistantService, the embedding client is built ONCE from the Zod-validated
 * config, and is null when no key is set (the app still boots; search just fails
 * with a clear 503).
 */
@Injectable()
export class DocumentsService {
  private readonly client: OpenAI | null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.config.get('GEMINI_API_KEY', { infer: true });
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL }) : null;
  }

  /**
   * Every document in every org the user belongs to (newest org-grouped). The
   * `where` clause is the authorization: it only matches documents whose org has
   * a membership for this user, so a user can never read another tenant's notes.
   * The embedding column is dropped — the UI doesn't need it.
   */
  async listForUser(userId: string): Promise<PublicDocument[]> {
    const documents = await this.prisma.document.findMany({
      where: { organization: { memberships: { some: { userId } } } },
      include: { organization: true },
      orderBy: [{ organization: { slug: 'asc' } }, { createdAt: 'asc' }],
    });

    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      organization: {
        id: doc.organization.id,
        name: doc.organization.name,
        slug: doc.organization.slug,
        createdAt: doc.organization.createdAt,
      },
      createdAt: doc.createdAt,
    }));
  }

  /**
   * Search ONE org's documents by meaning, but ONLY if `userId` is a member of
   * it. This is the same trust boundary as OrganizationsService.listMembersForUser:
   * the LLM is untrusted and may ask about ANY org, so we verify membership here
   * (404 to non-members) before any document leaves the database.
   */
  async searchForUser(
    userId: string,
    slug: string,
    query: string,
    limit = 3,
  ): Promise<DocumentMatch[]> {
    // AUTHORIZATION: prove the caller belongs to this org before reading its docs.
    const membership = await this.prisma.membership.findFirst({
      where: { user: { id: userId }, organization: { slug } },
    });
    if (!membership) throw new NotFoundException('Organization not found');

    const documents = await this.prisma.document.findMany({
      where: { organization: { slug } },
      include: { organization: true },
    });
    return this.rank(documents, query, limit);
  }

  /**
   * Search documents across EVERY org the user belongs to. Used when the user
   * asks a question without naming an org. The `where` clause is the authorization:
   * it only loads documents whose org has a membership for this user, so results
   * can never include another tenant's notes.
   */
  async searchAcrossUserOrgs(
    userId: string,
    query: string,
    limit = 3,
  ): Promise<DocumentMatch[]> {
    const documents = await this.prisma.document.findMany({
      where: { organization: { memberships: { some: { userId } } } },
      include: { organization: true },
    });
    return this.rank(documents, query, limit);
  }

  /**
   * Embed the question once, then rank the given documents by cosine similarity
   * and return the closest few. (With many documents you'd push this ranking into
   * the database via pgvector instead of doing it here.)
   */
  private async rank(
    documents: RankableDocument[],
    query: string,
    limit: number,
  ): Promise<DocumentMatch[]> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Document search is not configured. Set GEMINI_API_KEY in apps/api/.env.',
      );
    }
    if (documents.length === 0) return [];

    const queryVec = await embedText(this.client, query);

    return documents
      .map((doc) => ({
        title: doc.title,
        content: doc.content,
        organization: { name: doc.organization.name, slug: doc.organization.slug },
        score: cosineSimilarity(queryVec, doc.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
