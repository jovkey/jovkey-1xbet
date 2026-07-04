import { Controller, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { map, Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

interface MessageEvent {
  data: string;
  type?: string;
}

@ApiTags('realtime')
@Controller('realtime')
export class RealtimeController {
  constructor(private realtime: RealtimeService) {}

  /** Flux SSE public : alertes de pronostics + mises à jour CMS poussées en direct. */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.realtime.asObservable().pipe(
      map((event) => ({ type: event.type, data: JSON.stringify(event.data) })),
    );
  }
}
