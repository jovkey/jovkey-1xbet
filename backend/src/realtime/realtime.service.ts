import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface RealtimeEvent {
  type: string; // "prediction.new" | "cms.updated" | "marquee.updated" | ...
  data: unknown;
}

/**
 * Bus d'événements en mémoire diffusé aux clients via Server-Sent Events.
 * Le moteur d'analyse Python pousse ici (via l'API) ses opportunités validées,
 * et l'admin pousse les mises à jour CMS pour un rafraîchissement instantané du front.
 */
@Injectable()
export class RealtimeService {
  private readonly stream$ = new Subject<RealtimeEvent>();

  emit(event: RealtimeEvent) {
    this.stream$.next(event);
  }

  asObservable(): Observable<RealtimeEvent> {
    return this.stream$.asObservable();
  }
}
