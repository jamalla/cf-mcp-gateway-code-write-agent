'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        border: '1px solid #ccc',
        background: pending ? '#eee' : '#111',
        color: pending ? '#666' : '#fff',
        cursor: pending ? 'not-allowed' : 'pointer',
      }}
    >
      {pending ? 'Running...' : 'Run Agent'}
    </button>
  );
}
