import { UserRole } from '../../../shared/domain/user-role';
import { menuFor, permissionsFor } from './admin-permissions';
import { csvToRecords, parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('parses quoted fields, commas, quotes and line breaks', () => {
    const rows = parseCsv(
      'name,note\r\n"Obi, Ada","She said ""hi""\nthen left"\r\nTunde,ok\n',
    );
    expect(rows).toEqual([
      ['name', 'note'],
      ['Obi, Ada', 'She said "hi"\nthen left'],
      ['Tunde', 'ok'],
    ]);
  });

  it('reads records with forgiving headers and skips blank lines', () => {
    const records = csvToRecords(
      '﻿First Name,last_name,EMAIL\n\nAda,Obi,ada@x.test\n',
    );
    expect(records).toEqual([
      { firstname: 'Ada', lastname: 'Obi', email: 'ada@x.test' },
    ]);
  });

  it('escapes output and blocks spreadsheet formulas', () => {
    const csv = toCsv(
      [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ],
      [{ a: '=SUM(1,2)', b: 'say "hi"' }],
    );
    expect(csv).toBe('A,B\r\n"\'=SUM(1,2)","say ""hi"""\r\n');
  });
});

describe('admin permissions', () => {
  it('gives super admins everything and support admins a subset', () => {
    expect(permissionsFor(UserRole.SUPER_ADMIN)).toContain('plans.manage');
    const support = permissionsFor(UserRole.SUPPORT_ADMIN);
    expect(support).toEqual(
      expect.arrayContaining(['learners.bulk_add', 'users.help_access']),
    );
    expect(support).not.toContain('plans.manage');
    expect(support).not.toContain('content.review');
  });

  it('builds the menu from permissions', () => {
    expect(menuFor(UserRole.CONTENT_CREATOR).map((m) => m.key)).toEqual([
      'content',
    ]);
    expect(menuFor(UserRole.LEARNER)).toEqual([]);
  });
});
