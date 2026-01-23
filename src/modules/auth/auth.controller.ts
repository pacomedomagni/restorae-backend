import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AnonymousDto } from './dto/anonymous.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email/password' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('anonymous')
  @ApiOperation({ summary: 'Register anonymous device' })
  registerAnonymous(@Body() dto: AnonymousDto) {
    return this.authService.registerAnonymous(dto.deviceId, dto.platform);
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade anonymous to full account' })
  upgrade(@Request() req: any, @Body() dto: RegisterDto) {
    return this.authService.upgradeAnonymous(req.user.id, dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // =========================================================================
  // SSO Endpoints
  // =========================================================================

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with Apple' })
  signInWithApple(@Body() dto: { identityToken: string; name?: string; nonce?: string }) {
    return this.authService.signInWithApple(dto.identityToken, dto.name, dto.nonce);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with Google' })
  signInWithGoogle(@Body() dto: { idToken: string; platform?: 'web' | 'ios' | 'android' }) {
    return this.authService.signInWithGoogle(dto.idToken, dto.platform || 'ios');
  }

  @Post('link/apple')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link Apple account to existing user' })
  linkApple(@Request() req: any, @Body() dto: { identityToken: string }) {
    return this.authService.linkApple(req.user.id, dto.identityToken);
  }

  @Post('link/google')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link Google account to existing user' })
  linkGoogle(@Request() req: any, @Body() dto: { idToken: string; platform?: 'web' | 'ios' | 'android' }) {
    return this.authService.linkGoogle(req.user.id, dto.idToken, dto.platform || 'ios');
  }

  @Post('unlink')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink SSO provider from account' })
  unlinkSSO(@Request() req: any, @Body() dto: { provider: 'apple' | 'google' }) {
    return this.authService.unlinkSSO(req.user.id, dto.provider);
  }

  // =========================================================================
  // Password Reset Endpoints
  // =========================================================================

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() dto: { email: string }) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password/verify-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password reset token' })
  verifyResetToken(@Body() dto: { token: string }) {
    return this.authService.verifyResetToken(dto.token);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body() dto: { token: string; password: string }) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (logged in users)' })
  changePassword(
    @Request() req: any,
    @Body() dto: { currentPassword: string; newPassword: string }
  ) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
}
