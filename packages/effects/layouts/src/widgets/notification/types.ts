interface NotificationItem {
  id: number | string;
  avatar?: string;
  date: string;
  isRead?: boolean;
  message: string;
  title: string;
  /**
   * Navigation link, can be a route path or a full URL
   * @example '/dashboard' or 'https://example.com'
   */
  link?: string;
  query?: Record<string, unknown>;
  state?: Record<string, unknown>;
  /** Custom business fields */
  [key: string]: unknown;
}

export type { NotificationItem };
