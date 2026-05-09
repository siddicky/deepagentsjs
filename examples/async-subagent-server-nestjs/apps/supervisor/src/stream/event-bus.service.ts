import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface ProtocolEvent {
  method: string;
  params: {
    data: unknown;
    step?: number;
    namespace?: string[];
    checkpoint?: { checkpoint_id?: string };
    event_id?: string;
  };
}

@Injectable()
export class EventBusService {
  private readonly subjects = new Map<string, Subject<ProtocolEvent>>();

  getSubject(threadId: string): Subject<ProtocolEvent> {
    if (!this.subjects.has(threadId)) {
      this.subjects.set(threadId, new Subject<ProtocolEvent>());
    }
    return this.subjects.get(threadId)!;
  }

  emit(threadId: string, event: ProtocolEvent): void {
    this.subjects.get(threadId)?.next(event);
  }

  complete(threadId: string): void {
    const subject = this.subjects.get(threadId);
    if (subject) {
      subject.complete();
      this.subjects.delete(threadId);
    }
  }

  error(threadId: string, err: unknown): void {
    const subject = this.subjects.get(threadId);
    if (subject) {
      subject.error(err);
      this.subjects.delete(threadId);
    }
  }
}
