import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Cryptographically secure refresh token string',
    example: 'd9b3e1f0a2c4e689...64-char-hex-token',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token to revoke on logout (optional)',
    example: 'd9b3e1f0a2c4e689...64-char-hex-token',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
