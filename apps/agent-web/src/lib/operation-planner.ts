export type PlannedAction =
  | {
      type: 'customer.lookup';
      input: {
        email: string;
      };
    }
  | {
      type: 'order.getLatestByCustomer';
      input: {
        customer_id: string;
      };
    }
  | {
      type: 'report.salesSummary';
      input: {
        range: string;
      };
    };

export function planActionsFromPrompt(prompt: string): PlannedAction[] {
  const normalized = prompt.trim().toLowerCase();

  const emailMatch = normalized.match(
    /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  );

  if (normalized.includes('find customer') && emailMatch) {
    return [
      {
        type: 'customer.lookup',
        input: {
          email: emailMatch[1],
        },
      },
    ];
  }

  if (
    normalized.includes('latest order') &&
    emailMatch
  ) {
    return [
      {
        type: 'customer.lookup',
        input: {
          email: emailMatch[1],
        },
      },
    ];
  }

  if (
    normalized.includes('sales summary') ||
    normalized.includes('report')
  ) {
    return [
      {
        type: 'report.salesSummary',
        input: {
          range: 'last_30_days',
        },
      },
    ];
  }

  return [];
}
