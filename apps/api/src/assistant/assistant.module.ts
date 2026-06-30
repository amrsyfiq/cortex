import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/**
 * Imports OrganizationsModule and DocumentsModule so AssistantService can inject
 * their services (the LLM's tools call into them). ConfigService is global, so it
 * needs no import.
 */
@Module({
  imports: [OrganizationsModule, DocumentsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
