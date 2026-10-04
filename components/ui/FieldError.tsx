/** Inline validation message under a field. Renders nothing without a message. */
export function FieldError({ message }: { message?: string | null }) {
  if (message === undefined || message === null || message === "") return null;

  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}
