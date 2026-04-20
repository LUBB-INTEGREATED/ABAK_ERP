import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email + password' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token, return a new access + refresh pair' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Invalidate the supplied refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Current user profile (requires Bearer access token)' })
  me(@CurrentUser('id') userId: string) {
    return this.auth.getProfile(userId);
  }
}
