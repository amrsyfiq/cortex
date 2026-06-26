import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/**
 * Imports OrganizationsModule so AssistantService can inject OrganizationsService
 * (which that module now exports). ConfigService is global, so it needs no import.
 */
@Module({
  imports: [OrganizationsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
