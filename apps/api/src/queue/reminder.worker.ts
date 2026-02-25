/**
 * ReminderWorker — Placeholder
 *
 * TODO: Implement scheduled follow-up reminder notifications.
 *
 * This worker processes jobs from a 'reminder-queue' and sends
 * notifications (email, push, WhatsApp) to users with pending follow-ups.
 *
 * Implementation checklist:
 * 1. Register 'reminder-queue' in QueueModule:
 *    BullModule.registerQueue({ name: 'reminder-queue' })
 *
 * 2. Add the processor decorator:
 *    @Processor('reminder-queue')
 *    export class ReminderWorker extends WorkerHost { ... }
 *
 * 3. In process(), load the FollowUp from DB and route to the correct
 *    notification adapter (email / WhatsApp / push).
 *
 * 4. Schedule reminder jobs when a FollowUp is created:
 *    await queue.add('send-reminder', { followUpId }, {
 *      delay: computeDelayMs(followUp.scheduledAt),
 *    });
 */

export class ReminderWorker {
  // Not yet implemented
}
