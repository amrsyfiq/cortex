import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/**
 * Provides semantic document search + a read API for the notes. Exports the
 * service so AssistantModule can inject it into the AI assistant's tool.
 * PrismaService (global) and ConfigService (global) need no import here.
 */
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
