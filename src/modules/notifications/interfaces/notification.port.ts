export interface NotificationMessage {
  userId: string;
  email?: string;
  title: string;
  body: string;
  channel: 'in_app' | 'email';
}

export interface NotificationPort {
  send(message: NotificationMessage): Promise<void>;
}
