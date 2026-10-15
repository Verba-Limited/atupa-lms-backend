// Public API of the classes module.
export { ClassesModule } from './classes.module';
export { ClassesService } from './application/classes.service';
export type { Classroom } from './domain/classroom.entity';
export { canManageClass, canViewClass } from './domain/classroom.entity';
