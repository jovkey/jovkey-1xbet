import { ApiProperty } from '@nestjs/swagger';
import { ReceiverNetwork } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CheckoutInitDto {
  @ApiProperty({ enum: ReceiverNetwork })
  @IsEnum(ReceiverNetwork)
  receiverNetwork!: ReceiverNetwork;

  @ApiProperty({ description: 'Puce précise assignée par le front (répartition multi-SIM)' })
  @IsString() @MinLength(6)
  receiverPhone!: string;

  @ApiProperty()
  @IsString() @MinLength(6)
  senderPhone!: string;

  @ApiProperty({ required: false, description: 'Nom/prénom de l’expéditeur (envois internationaux)' })
  @IsOptional() @IsString()
  senderName?: string;

  @ApiProperty({ required: false, description: 'ID du reçu opérateur (audit seulement)' })
  @IsOptional() @IsString()
  txId?: string;

  @ApiProperty({ enum: ['gold_subscription', 'investor_deposit'] })
  @IsIn(['gold_subscription', 'investor_deposit'])
  purpose!: 'gold_subscription' | 'investor_deposit';

  @ApiProperty({ required: false, description: 'Montant (requis pour investor_deposit ; ignoré pour Gold)' })
  @IsOptional() @IsNumber() @IsPositive()
  amount?: number;
}

/** Payload envoyé par le téléphone Listener à chaque SMS de réception encaissé. */
export class SmsWebhookDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  txId?: string;

  @ApiProperty()
  @IsNumber() @IsPositive()
  amount!: number;

  @ApiProperty()
  @IsString() @MinLength(6)
  senderPhone!: string;

  @ApiProperty({ enum: ReceiverNetwork })
  @IsEnum(ReceiverNetwork)
  receiverNetwork!: ReceiverNetwork;

  @ApiProperty({ description: 'Puce sur laquelle le SMS est arrivé (numéro local)' })
  @IsString() @MinLength(6)
  receiverPhone!: string;

  @ApiProperty({ required: false, description: 'Texte brut du SMS (audit)' })
  @IsOptional() @IsString()
  raw?: string;
}
