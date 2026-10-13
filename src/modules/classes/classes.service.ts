import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRole } from '../../common/enums/user-role.enum';
import { Classroom, ClassroomDocument } from './schemas/classroom.schema';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Classroom.name)
    private readonly classroomModel: Model<Classroom>,
  ) {}

  createClass(input: {
    schoolId: string;
    teacherUserId: string;
    name: string;
  }) {
    return this.classroomModel.create(input);
  }

  addStudent(classroomId: string, studentUserId: string, actorSchoolId?: string) {
    return this.classroomModel
      .findOneAndUpdate(
        { _id: classroomId, ...(actorSchoolId ? { schoolId: actorSchoolId } : {}) },
        { $addToSet: { studentUserIds: studentUserId } },
        { new: true },
      )
      .exec()
      .then((doc) => {
        if (!doc) throw new NotFoundException('Class not found');
        return doc;
      });
  }

  assignCourse(classroomId: string, courseId: string, actorUserId: string, role: UserRole) {
    if (![UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN].includes(role)) {
      throw new ForbiddenException('Cannot assign courses');
    }
    return this.classroomModel
      .findOneAndUpdate(
        { _id: classroomId, teacherUserId: role === UserRole.TEACHER ? actorUserId : { $exists: true } },
        { $addToSet: { assignedCourseIds: courseId } },
        { new: true },
      )
      .exec();
  }

  listForTeacher(teacherUserId: string): Promise<ClassroomDocument[]> {
    return this.classroomModel.find({ teacherUserId }).exec();
  }

  listForSchool(schoolId: string): Promise<ClassroomDocument[]> {
    return this.classroomModel.find({ schoolId }).exec();
  }
}
