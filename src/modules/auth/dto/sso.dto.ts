import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';

export class AppleSignInDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  nonce?: string;
}

export class GoogleSignInDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsOptional()
  @IsIn(['web', 'ios', 'android'])
  platform?: 'web' | 'ios' | 'android';
}

export class AppleLinkDto {
  @IsString()
  @IsNotEmpty()
  identityToken: string;
}

export class GoogleLinkDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsOptional()
  @IsIn(['web', 'ios', 'android'])
  platform?: 'web' | 'ios' | 'android';
}

export class UnlinkSSODto {
  @IsIn(['apple', 'google'])
  provider: 'apple' | 'google';
}

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;
}

export class VerifyResetTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  newPassword: string;
}
