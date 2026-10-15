// Public API of the schools module.
export { SchoolsModule } from './schools.module';
export { SchoolsService } from './application/schools.service';
export type { School, SchoolSettings } from './domain/school.entity';
export { canAdministerSchool } from './domain/school.entity';
