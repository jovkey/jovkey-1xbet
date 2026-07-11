import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { FedapayService } from './fedapay.service';
import { RenewalReminderService } from './renewal-reminder.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [NotificationsModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FedapayService, RenewalReminderService],
  exports: [PaymentsService, FedapayService],
})
export class PaymentsModule {}
