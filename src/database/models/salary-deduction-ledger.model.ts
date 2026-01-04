import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from './employee.model';
import { Attendance } from './attendance.model';

@Table({
  tableName: 'salary_deduction_ledgers',
  timestamps: false,
})
export class SalaryDeductionLedger extends Model<SalaryDeductionLedger> {
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
  })
  declare employeeId: string;

  @ForeignKey(() => Attendance)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare attendanceId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    comment: 'Deducted minutes',
  })
  declare deductedMinutes: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Deducted amount',
  })
  declare deductedAmount: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare reason: string;

  @CreatedAt
  declare createdAt: Date;

  @BelongsTo(() => Employee)
  employee: Employee;

  @BelongsTo(() => Attendance)
  attendance: Attendance;
}

