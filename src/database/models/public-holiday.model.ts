import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';

@Table({
  tableName: 'public_holidays',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['date'],
    },
  ],
})
export class PublicHoliday extends Model<PublicHoliday> {
  @PrimaryKey
  @Default(() => uuidv4())
  @Column({
    type: DataType.UUID,
  })
  declare id: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    unique: true,
    comment: 'Date of the public holiday (YYYY-MM-DD)',
  })
  declare date: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    comment: 'Name/description of the holiday',
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Optional description or notes',
  })
  declare description: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

