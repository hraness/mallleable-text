import { useState, type ReactElement } from "react";

import type { MalleableTextAccess } from "./contract.js";

export interface MalleableTextAccountControlProps {
  readonly access: MalleableTextAccess;
  readonly className?: string;
  readonly signInLabel?: string;
  readonly signOutLabel?: string;
}

export function MalleableTextAccountControl({
  access,
  className,
  signInLabel = "Sign in to edit",
  signOutLabel = "Sign out",
}: MalleableTextAccountControlProps): ReactElement | null {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (access.status === "read-only") return null;

  const action = access.status === "no-session" ? access.signIn : access.signOut;
  const label = access.status === "no-session" ? signInLabel : signOutLabel;
  const runAction = (): void => {
    if (action === undefined || pending) return;
    setPending(true);
    setError(null);
    Promise.resolve().then(action).catch(() => {
      setError("The account action did not complete. Try again.");
    }).finally(() => {
      setPending(false);
    });
  };

  return (
    <div className={className}>
      {access.status === "authorized" && access.accountLabel !== undefined ? (
        <span>{access.accountLabel}</span>
      ) : null}
      {action === undefined ? null : (
        <button disabled={pending} onClick={runAction} type="button">
          {pending ? "Please wait" : label}
        </button>
      )}
      {error === null ? null : <p role="alert">{error}</p>}
    </div>
  );
}
