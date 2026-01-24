import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from './user.model';
import { Attendance } from './attendance.model';
import { MonthlyAttendanceSummary } from './monthly-attendance-summary.model';
import { SalaryDeductionLedger } from './salary-deduction-ledger.model';
import { LeaveRequest } from './leave-request.model';

@Table({
  tableName: 'employees',
  timestamps: true,
})
export class Employee extends Model<Employee> {
  @PrimaryKey
  @Default(() => uuidv4())
  @Column({
    type: DataType.UUID,
  })
  declare id: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare userId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare fullName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare phone: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare designation: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare dailySalary: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  declare joiningDate: Date;

  @Column({
    type: DataType.ENUM('full-time', 'probation', 'notice-period'),
    allowNull: false,
    defaultValue: 'full-time',
  })
  declare status: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deletedAt: Date | null;

  @BelongsTo(() => User, { foreignKey: 'userId', as: 'user' })
  user: User;

  @HasMany(() => Attendance, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  attendances: Attendance[];

  @HasMany(() => MonthlyAttendanceSummary, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  monthlySummaries: MonthlyAttendanceSummary[];

  @HasMany(() => SalaryDeductionLedger, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  deductionLedgers: SalaryDeductionLedger[];

  @HasMany(() => LeaveRequest, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  leaveRequests: LeaveRequest[];
}

