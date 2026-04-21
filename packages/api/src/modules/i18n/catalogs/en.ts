export const en = {
  errors: {
    generic: 'An unexpected error occurred.',
    unauthorized: 'Unauthorized.',
    forbidden: 'Insufficient permissions.',
    notFound: 'Resource not found.',
    validation: 'The submitted data is invalid.',
    lead: {
      notFound: 'Lead not found.',
      duplicate: 'A lead with the same phone or email already exists.',
    },
    client: {
      notFound: 'Client not found.',
    },
    quote: {
      notFound: 'Quote not found.',
      cannotEdit: 'Quote cannot be edited in its current state.',
    },
    auth: {
      invalidCredentials: 'Invalid credentials.',
      accountLocked: 'Account is locked. Try again later.',
    },
  },
  enums: {
    leadStatus: {
      NEW: 'New',
      ASSIGNED: 'Assigned',
      CONTACTED: 'Contacted',
      QUALIFIED: 'Qualified',
      UNQUALIFIED: 'Unqualified',
      CONVERTED: 'Converted',
      LOST: 'Lost',
      DUPLICATE: 'Duplicate',
    },
  },
} as const;
