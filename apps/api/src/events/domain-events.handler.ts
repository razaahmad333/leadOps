import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENTS,
  LeadCreatedEvent,
  ReportDeliveredEvent,
  StatusChangedEvent,
} from '@leadops/shared';
import { MetricsService } from '../common/metrics/metrics.service';

@Injectable()
export class DomainEventsHandler {
  private readonly logger = new Logger(DomainEventsHandler.name);

  constructor(private readonly metrics: MetricsService) {}

  @OnEvent(DOMAIN_EVENTS.LEAD_CREATED)
  handleLeadCreated(event: LeadCreatedEvent): void {
    this.metrics.increment('domain.lead.created');
    this.logger.log(JSON.stringify({ event: DOMAIN_EVENTS.LEAD_CREATED, ...event }));
  }

  @OnEvent(DOMAIN_EVENTS.STATUS_CHANGED)
  handleStatusChanged(event: StatusChangedEvent): void {
    this.metrics.increment('domain.status.changed');
    this.logger.log(JSON.stringify({ event: DOMAIN_EVENTS.STATUS_CHANGED, ...event }));
  }

  @OnEvent(DOMAIN_EVENTS.REPORT_DELIVERED)
  handleReportDelivered(event: ReportDeliveredEvent): void {
    this.metrics.increment('domain.report.delivered');
    this.logger.log(JSON.stringify({ event: DOMAIN_EVENTS.REPORT_DELIVERED, ...event }));
  }
}
