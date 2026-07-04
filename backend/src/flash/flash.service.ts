import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { FlashLeadDto } from './flash.controller';

@Injectable()
export class FlashService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  async submitLead(dto: FlashLeadDto) {
    const lead = await this.prisma.flashLead.create({
      data: {
        id1xbet: dto.id1xbet.trim(),
        whatsappNum: dto.whatsappNum.trim(),
        sourceTunnel: dto.sourceTunnel ?? 'flash',
        status: 'pending',
      },
    });
    // Notifie le panel admin en direct qu'un lead arrive.
    this.realtime.emit({ type: 'flash.lead.new', data: { id: lead.id } });
    return {
      leadId: lead.id,
      status: 'pending',
      message:
        "Votre demande d'accès a été transmise. Nous vérifions l'activation du code " +
        'JOVKEY sur votre ID sous 24h. Vous recevrez votre lien exclusif par WhatsApp.',
    };
  }

  async getStatus(id: string) {
    const lead = await this.prisma.flashLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Demande introuvable');
    return { status: lead.status };
  }

  listPending() {
    return this.prisma.flashLead.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Validation manuelle : crée le compte membre et "envoie" le lien communautaire. */
  async approve(id: string, password: string, role: 'gold' | 'investor') {
    const lead = await this.prisma.flashLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Demande introuvable');
    if (!password || password.length < 6) {
      throw new BadRequestException('Mot de passe initial trop court (min 6)');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.upsert({
      where: { id1xbet: lead.id1xbet },
      update: { statusFlash: 'approved', passwordHash, role, communityLinkSent: true },
      create: {
        id1xbet: lead.id1xbet,
        whatsappNum: lead.whatsappNum,
        passwordHash,
        role,
        statusFlash: 'approved',
        communityLinkSent: true,
      },
    });
    await this.prisma.flashLead.update({
      where: { id },
      data: { status: 'approved', reviewedAt: new Date() },
    });

    this.realtime.emit({ type: 'flash.lead.approved', data: { id } });
    return { userId: user.id, status: 'approved' };
  }

  async reject(id: string) {
    await this.prisma.flashLead.update({
      where: { id },
      data: { status: 'rejected', reviewedAt: new Date() },
    });
    return { status: 'rejected' };
  }

  /**
   * Validation Flash SANS création de compte : le membre Flash n'a pas de compte
   * sur le site. On marque juste la demande "approved" (le client voit alors
   * « compte validé » sur le site), l'admin lui ayant envoyé le lien par WhatsApp.
   */
  async validateLead(id: string) {
    const lead = await this.prisma.flashLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Demande introuvable');
    await this.prisma.flashLead.update({
      where: { id },
      data: { status: 'approved', reviewedAt: new Date() },
    });
    this.realtime.emit({ type: 'flash.lead.approved', data: { id } });
    return { ok: true, status: 'approved' };
  }
}
