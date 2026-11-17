import { IsOptional, IsUUID } from 'class-validator';

export class GetEmailPreferencesUsersQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'roleId must be a valid UUID' })
  roleId?: string;
}
