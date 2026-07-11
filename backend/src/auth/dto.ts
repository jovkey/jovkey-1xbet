import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'client@email.com', description: 'Adresse email du compte' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'monMotDePasse' })
  @IsString()
  @MinLength(6)
  password!: string;
}

/**
 * Inscription Gold : compte créé avec un EMAIL (pas d'ID 1xBet ici).
 * Le paiement (5600 FCFA) est OBLIGATOIRE → compte `pending_payment` jusqu'à validation.
 */
export class SignupGoldDto {
  @ApiProperty({ example: 'client@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'monMotDePasse' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Togo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;
}

/**
 * Inscription Investisseur : compte par EMAIL, sans paiement immédiat.
 * L'investisseur rechargera son capital ensuite depuis son espace.
 */
export class SignupInvestorDto {
  @ApiProperty({ example: 'investisseur@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'monMotDePasse' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Togo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;
}

/** Recharge de capital investisseur (déclaration de paiement). */
export class RechargeDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: 'mtn' })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: '+22890000000' })
  @IsString()
  @MinLength(3)
  reference!: string;
}

/** Changement de mot de passe (membre connecté). */
export class ChangePasswordDto {
  @ApiProperty({ example: 'monAncienMotDePasse' })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({ example: 'monNouveauMotDePasse' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

/** Demande de code de réinitialisation par email. */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'client@email.com' })
  @IsEmail()
  email!: string;
}

/** Vérification du code + nouveau mot de passe. */
export class ResetPasswordDto {
  @ApiProperty({ example: 'client@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;

  @ApiProperty({ example: 'monNouveauMotDePasse' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

/** Demande de retrait investisseur. */
export class WithdrawalDto {
  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: 'mtn' })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: '+22890000000' })
  @IsString()
  @MinLength(3)
  destination!: string;
}
