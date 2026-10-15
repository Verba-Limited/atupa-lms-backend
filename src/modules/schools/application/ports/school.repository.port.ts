import { CrudPort } from '../../../../shared/application/crud.port';
import { Page, PageRequest } from '../../../../shared/domain/pagination';
import { School } from '../../domain/school.entity';

export const SCHOOL_REPOSITORY = Symbol('SCHOOL_REPOSITORY');

export interface SchoolRepository extends CrudPort<School> {
  findByJoinCode(code: string): Promise<School | null>;
  findByName(name: string): Promise<School | null>;
  list(
    filter: { q?: string; isActive?: boolean },
    page: PageRequest,
  ): Promise<Page<School>>;
  count(): Promise<number>;
}
