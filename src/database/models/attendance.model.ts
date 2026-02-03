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
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from './employee.model';
import { SalaryDeductionLedger } from './salary-deduction-ledger.model';
import { HasMany } from 'sequelize-typescript';

@Table({
  tableName: 'attendances',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['employeeId', 'date'],
    },
  ],
})
export class Attendance extends Model<Attendance> {
  @PrimaryKey
  @Default(() => uuidv4())
  @Column({
    type: DataType.UUID,
  })
  declare id: string;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  declare employeeId: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  declare date: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare checkInTime: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare checkOutTime: Date | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Total worked minutes',
  })
  declare totalWorkedMinutes: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: 0,
    comment: 'Short minutes (if worked < 9 hours)',
  })
  declare shortMinutes: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Salary earned for this day',
  })
  declare salaryEarned: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if this is an unpaid leave day (no check-in/check-out)',
  })
  declare unpaidLeave: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if this is a public holiday',
  })
  declare isPublicHoliday: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'True if this attendance record is active (has check-in or is past date)',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if check-in was more than n minutes after standard check-in (PKT)',
  })
  declare isLate: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if check-in was more than 1 hour after standard check-in (half day for salary)',
  })
  declare isHalfDay: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deletedAt: Date | null;

  @BelongsTo(() => Employee)
  employee: Employee;

  @HasMany(() => SalaryDeductionLedger, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  deductionLedgers: SalaryDeductionLedger[];
}

