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

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Table({
  tableName: 'leave_requests',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['employeeId', 'date'],
    },
  ],
})
export class LeaveRequest extends Model<LeaveRequest> {
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
    comment: 'Date for which leave is requested',
  })
  declare date: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    comment: 'Number of hours for leave (1-9)',
    validate: {
      min: 1,
      max: 9,
    },
  })
  declare hours: number;

  @Column({
    type: DataType.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: LeaveStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Optional reason for leave',
  })
  declare reason: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of unpaid hours (when leave balance is insufficient)',
  })
  declare unpaidHours: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  @BelongsTo(() => Employee)
  employee: Employee;
}

