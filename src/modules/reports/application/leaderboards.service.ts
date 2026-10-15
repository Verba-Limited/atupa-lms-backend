import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor';
import { ForbiddenError, ValidationError } from '../../../shared/domain/errors';
import { displayName, shortName } from '../../../shared/domain/text';
import { UserRole } from '../../../shared/domain/user-role';
import { ClassesService } from '../../classes';
import { UsersService } from '../../identity';
import { ProgressQueryService } from '../../progress';
import { SchoolsService } from '../../schools';

export type LeaderboardScope = 'global' | 'school' | 'class';
export type LeaderboardPeriod = 'week' | 'month' | 'all';

/** Optional leaderboards (PRD section 15) with child-safe name display. */
@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly progress: ProgressQueryService,
    private readonly users: UsersService,
    private readonly classes: ClassesService,
    private readonly schools: SchoolsService,
  ) {}

  async get(
    actor: Actor,
    input: {
      scope: LeaderboardScope;
      period: LeaderboardPeriod;
      classId?: string;
      limit: number;
    },
  ) {
    let userIds: string[] | undefined;
    let showFullNames = false;
    let schoolId: string | undefined;

    if (input.scope === 'class') {
      if (!input.classId)
        throw new ValidationError('classId is required for class leaderboards');
      const classroom = await this.classes.requireViewable(
        actor,
        input.classId,
      );
      userIds = classroom.studentUserIds;
      schoolId = classroom.schoolId ?? undefined;
    } else if (input.scope === 'school') {
      schoolId = actor.schoolId;
      if (!schoolId)
        throw new ForbiddenError('You are not attached to a school');
      userIds = await this.users.findIds({ schoolId, role: UserRole.LEARNER });
    }
    if (schoolId) {
      const settings = await this.schools.getSettings(schoolId);
      if (!settings.leaderboardsEnabled)
        throw new ForbiddenError('Leaderboards are turned off for this school');
      showFullNames = settings.showLearnerNamesOnLeaderboards;
    }

    const since =
      input.period === 'week'
        ? new Date(Date.now() - 7 * 86_400_000)
        : input.period === 'month'
          ? new Date(Date.now() - 30 * 86_400_000)
          : undefined;
    const rows =
      userIds?.length === 0
        ? []
        : await this.progress.pointsLeaderboard({
            since,
            userIds,
            limit: input.limit,
          });
    const users = new Map(
      (await this.users.findByIds(rows.map((r) => r.userId))).map((u) => [
        u.id,
        u,
      ]),
    );
    return {
      scope: input.scope,
      period: input.period,
      entries: rows.map((row, index) => {
        const user = users.get(row.userId);
        const isMe = row.userId === actor.userId;
        return {
          rank: index + 1,
          userId: isMe || showFullNames ? row.userId : undefined,
          name: user
            ? showFullNames || isMe
              ? displayName(user)
              : shortName(user)
            : 'Learner',
          points: row.points,
          isMe,
        };
      }),
    };
  }
}
