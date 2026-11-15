import { actionName } from '../presentation/http/audit.interceptor';
import { sanitizeDetails } from './audit-entry.entity';

describe('activity log', () => {
  it('names actions from the route', () => {
    expect(actionName('POST', 'authoring/courses')).toBe(
      'authoring.courses.create',
    );
    expect(actionName('POST', 'authoring/courses/:courseId/publish')).toBe(
      'authoring.courses.publish',
    );
    expect(actionName('PATCH', 'admin/users/:userId')).toBe(
      'admin.users.update',
    );
    expect(actionName('DELETE', 'admin/users/:userId')).toBe(
      'admin.users.delete',
    );
    expect(actionName('POST', 'admin/users/:userId/verification')).toBe(
      'admin.users.verification',
    );
  });

  it('removes secrets and shortens long values', () => {
    const clean = sanitizeDetails({
      password: 'Passw0rd!',
      nested: { token: 'abc', note: 'x'.repeat(400) },
      list: Array.from({ length: 25 }, (_, i) => i),
    }) as Record<string, unknown>;
    expect(clean.password).toBe('[redacted]');
    const nested = clean.nested as Record<string, string>;
    expect(nested.token).toBe('[redacted]');
    expect(nested.note.length).toBeLessThan(310);
    expect((clean.list as unknown[]).length).toBe(21);
  });
});
