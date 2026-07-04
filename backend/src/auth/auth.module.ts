import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    PassportModule,
    PaymentsModule,
    JwtModule.register({
      // Pas de fallback faible : JwtStrategy fait déjà échouer le démarrage si absent,
      // ici on garde le typage strict (process.env.JWT_SECRET peut être undefined en théorie).
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
