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

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

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
}

