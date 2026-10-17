import type {
  PushContent,
  PushSender,
  SendOutcome,
  SendResult,
} from "@/lib/notifications/sender";

/**
 * A `PushSender` that records what it was asked to send and answers from a
 * lookup table. No network, no Firebase credentials, no real customer push.
 */
export class StubSender implements PushSender {
  readonly calls: Array<{ token: string; content: PushContent }> = [];
  readonly behavior = new Map<string, SendOutcome>();
  defaultOutcome: SendOutcome = "sent";
  configured = true;

  tokensSentTo(): string[] {
    return this.calls.map((call) => call.token);
  }

  async send(token: string, content: PushContent): Promise<SendResult> {
    this.calls.push({ token, content });
    const outcome = this.behavior.get(token) ?? this.defaultOutcome;
    if (outcome === "sent") {
      return { outcome, messageId: `msg_${this.calls.length}` };
    }
    if (outcome === "invalid-token") {
      return { outcome, error: "messaging/registration-token-not-registered" };
    }
    return { outcome, error: `${outcome}-error` };
  }
}

/** A sender whose `send()` always rejects, to prove failures are contained. */
export class ExplodingSender implements PushSender {
  readonly configured = true;
  async send(): Promise<SendResult> {
    throw new Error("transport exploded");
  }
}
