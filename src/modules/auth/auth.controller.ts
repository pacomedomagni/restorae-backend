import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AnonymousDto } from './dto/anonymous.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/types/user-payload.interface';
import {
  AuthTokensResponseDto,
  MessageResponseDto,
  UserProfileResponseDto,
  TokenValidResponseDto,
} from '../../common/dto/responses.dto';
import {
  AppleSignInDto,
  GoogleSignInDto,
  AppleLinkDto,
  GoogleLinkDto,
  UnlinkSSODto,
  ForgotPasswordDto,
  VerifyResetTokenDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/sso.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email/password' })
  @ApiResponse({ status: 201, description: 'User registered', type: AuthTokensResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthTokensResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('anonymous')
  @ApiOperation({ summary: 'Register anonymous device' })
  @ApiResponse({ status: 201, description: 'Anonymous user created', type: AuthTokensResponseDto })
  registerAnonymous(@Body() dto: AnonymousDto) {
    return this.authService.registerAnonymous(dto.deviceId, dto.platform);
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade anonymous to full account' })
  @ApiResponse({ status: 201, description: 'Account upgraded', type: AuthTokensResponseDto })
  upgrade(@Request() req: AuthenticatedRequest, @Body() dto: RegisterDto) {
    return this.authService.upgradeAnonymous(req.user.id, dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthTokensResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out', type: MessageResponseDto })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // =========================================================================
  // SSO Endpoints
  // =========================================================================

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with Apple' })
  @ApiResponse({ status: 200, description: 'Apple sign-in successful', type: AuthTokensResponseDto })
  signInWithApple(@Body() dto: AppleSignInDto) {
    return this.authService.signInWithApple(dto.identityToken, dto.name, dto.nonce);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with Google' })
  @ApiResponse({ status: 200, description: 'Google sign-in successful', type: AuthTokensResponseDto })
  signInWithGoogle(@Body() dto: GoogleSignInDto) {
    return this.authService.signInWithGoogle(dto.idToken, dto.platform || 'ios');
  }

  @Post('link/apple')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link Apple account to existing user' })
  @ApiResponse({ status: 200, description: 'Apple account linked', type: UserProfileResponseDto })
  linkApple(@Request() req: AuthenticatedRequest, @Body() dto: AppleLinkDto) {
    return this.authService.linkApple(req.user.id, dto.identityToken);
  }

  @Post('link/google')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link Google account to existing user' })
  @ApiResponse({ status: 200, description: 'Google account linked', type: UserProfileResponseDto })
  linkGoogle(@Request() req: AuthenticatedRequest, @Body() dto: GoogleLinkDto) {
    return this.authService.linkGoogle(req.user.id, dto.idToken, dto.platform || 'ios');
  }

  @Post('unlink')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink SSO provider from account' })
  @ApiResponse({ status: 200, description: 'Provider unlinked', type: UserProfileResponseDto })
  unlinkSSO(@Request() req: AuthenticatedRequest, @Body() dto: UnlinkSSODto) {
    return this.authService.unlinkSSO(req.user.id, dto.provider);
  }

  // =========================================================================
  // Password Reset Endpoints
  // =========================================================================

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent', type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password/verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiResponse({ status: 200, description: 'Token validity', type: TokenValidResponseDto })
  verifyResetToken(@Body() dto: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(dto.token);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (logged in users)' })
  @ApiResponse({ status: 200, description: 'Password changed', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
}
