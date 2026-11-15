import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ValidationError } from '../../../shared/domain/errors';
import { UserRole } from '../../../shared/domain/user-role';
import { CatalogQueryService } from '../../catalog';
import { ClassesService } from '../../classes';
import { UsersService } from '../../identity';
import { csvToRecords } from '../domain/csv';

export const MAX_BULK_ROWS = 500;

/** Expected columns (any case/spacing): first name is the only one besides email that is required. */
export const BULK_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'dateOfBirth',
  'preferredLanguageCode',
] as const;

export interface BulkRowResult {
  row: number;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ok' | 'error' | 'created';
  errors: string[];
  userId?: string;
}

interface ParsedRow {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: Date;
  preferredLanguageCode?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bulk add learners from a CSV (M-11). A dry run checks every row and lists
 * the problems; nothing is saved until the whole file is clean. Each new
 * learner gets an email to set their password.
 */
@Injectable()
export class BulkLearnersService {
  constructor(
    private readonly users: UsersService,
    private readonly catalog: CatalogQueryService,
    private readonly classes: ClassesService,
  ) {}

  async run(
    actor: Actor,
    csv: string,
    options: { dryRun: boolean; classId?: string },
  ) {
    const records = csvToRecords(csv);
    if (!records.length) {
      throw new ValidationError(
        'The file is empty. Add a header row: firstName,lastName,email,dateOfBirth,preferredLanguageCode',
      );
    }
    if (records.length > MAX_BULK_ROWS) {
      throw new ValidationError(
        `Upload at most ${MAX_BULK_ROWS} learners per file`,
      );
    }
    if (options.classId) {
      await this.classes.requireManaged(actor, options.classId);
    }
    const languages = new Set(
      (await this.catalog.listLanguages(false)).map((l) => l.code),
    );
    const seen = new Set<string>();
    const results: BulkRowResult[] = [];
    const parsed: ParsedRow[] = [];
    for (const [index, record] of records.entries()) {
      const { row, errors } = parseRow(record, languages);
      const key = row.email.toLowerCase();
      if (key && seen.has(key)) errors.push('Email appears twice in the file');
      if (key) seen.add(key);
      if (key && EMAIL.test(key) && (await this.users.findByEmail(key))) {
        errors.push('Email is already registered');
      }
      parsed.push(row);
      results.push({
        row: index + 2, // header is row 1
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        status: errors.length ? 'error' : 'ok',
        errors,
      });
    }
    const failed = results.filter((r) => r.status === 'error').length;
    const summary = {
      dryRun: options.dryRun,
      total: results.length,
      valid: results.length - failed,
      failed,
      created: 0,
      addedToClass: 0,
    };
    if (options.dryRun || failed) {
      return { ...summary, saved: false, rows: results };
    }

    const createdIds: string[] = [];
    for (const [i, row] of parsed.entries()) {
      const user = await this.users.invite({
        email: row.email,
        role: UserRole.LEARNER,
        firstName: row.firstName,
        lastName: row.lastName || undefined,
        dateOfBirth: row.dateOfBirth,
        preferredLanguageCode: row.preferredLanguageCode,
        invitedByName: 'ATUPA',
      });
      results[i].status = 'created';
      results[i].userId = user.id;
      createdIds.push(user.id);
    }
    let addedToClass = 0;
    if (options.classId && createdIds.length) {
      await this.classes.addStudents(actor, options.classId, createdIds);
      addedToClass = createdIds.length;
    }
    return {
      ...summary,
      created: createdIds.length,
      addedToClass,
      saved: true,
      rows: results,
    };
  }
}

function parseRow(
  record: Record<string, string>,
  languages: Set<string>,
): { row: ParsedRow; errors: string[] } {
  const errors: string[] = [];
  const firstName = record.firstname ?? record.name ?? '';
  const lastName = record.lastname ?? record.surname ?? '';
  const email = (record.email ?? '').trim();
  const dob = record.dateofbirth ?? record.dob ?? '';
  const language = (
    record.preferredlanguagecode ??
    record.language ??
    ''
  ).toLowerCase();

  if (!firstName) errors.push('First name is required');
  else if (firstName.length > 60) errors.push('First name is too long');
  if (lastName.length > 60) errors.push('Last name is too long');
  if (!email) errors.push('Email is required');
  else if (!EMAIL.test(email)) errors.push('Email is not valid');

  let dateOfBirth: Date | undefined;
  if (!dob) {
    errors.push('Date of birth is required (YYYY-MM-DD)');
  } else {
    dateOfBirth = new Date(dob);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
      Number.isNaN(dateOfBirth.getTime())
    ) {
      errors.push('Date of birth must look like 2014-05-20');
      dateOfBirth = undefined;
    } else if (dateOfBirth.getTime() > Date.now()) {
      errors.push('Date of birth cannot be in the future');
    }
  }
  if (language && !languages.has(language)) {
    errors.push(`Unknown language "${language}"`);
  }
  return {
    row: {
      firstName,
      lastName,
      email,
      dateOfBirth,
      preferredLanguageCode: language || undefined,
    },
    errors,
  };
}
