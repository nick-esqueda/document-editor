import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DocumentAccessResponse, PublicUser } from "@doc-editor/shared";
import {
  fetchDocumentAccess,
  grantDocumentAccess,
  revokeDocumentAccess,
} from "../api/documentsApi";
import { listUsers } from "../api/usersApi";
import { useModalFocus } from "../components/useModalFocus";

const LOAD_FAILED_MESSAGE = "Sharing details couldn't be loaded.";
const ACTION_FAILED_MESSAGE = "That didn't work. Please try again.";

interface ShareDialogProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
}

/** Owner-only dialog for choosing who else can open and edit the document. */
export function ShareDialog({
  documentId,
  documentTitle,
  onClose,
}: ShareDialogProps) {
  const { access, setAccess, users, errorMessage, setErrorMessage } =
    useSharingDetails(documentId);
  // One change at a time, so a slow response can't overwrite a newer list.
  const [isChanging, setIsChanging] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);
    setIsChanging(true);
    try {
      await action();
    } catch {
      setErrorMessage(ACTION_FAILED_MESSAGE);
    } finally {
      setIsChanging(false);
    }
  }

  function handleAdd(userId: string) {
    return runAction(async () => {
      setAccess(await grantDocumentAccess(documentId, userId));
    });
  }

  function handleRemove(user: PublicUser) {
    return runAction(async () => {
      await revokeDocumentAccess(documentId, user.id);
      setAccess((current) => current && removePerson(current, user.id));
    });
  }

  return (
    <div className="overlay">
      <div
        className="dialog share-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
      >
        <div className="dialog-head">
          <h2 id="share-title">Share "{documentTitle}"</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}
        {access && users ? (
          <>
            <AddPersonForm
              candidates={listCandidates(users, access)}
              isDisabled={isChanging}
              onAdd={handleAdd}
            />
            <PeopleWithAccess
              access={access}
              isDisabled={isChanging}
              onRemove={handleRemove}
            />
          </>
        ) : (
          !errorMessage && <p className="loading">Loading…</p>
        )}
        <p className="meta">
          People with access can view and edit this document.
        </p>
      </div>
    </div>
  );
}

function AddPersonForm({
  candidates,
  isDisabled,
  onAdd,
}: {
  candidates: PublicUser[];
  isDisabled: boolean;
  onAdd: (userId: string) => Promise<void>;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedUserId && !isDisabled) {
      await onAdd(selectedUserId);
      setSelectedUserId("");
    }
  }

  return (
    <form className="add-person" onSubmit={handleSubmit}>
      <label htmlFor="share-user">Add people</label>
      <div className="add-person-row">
        <select
          id="share-user"
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
        >
          <option value="">
            {candidates.length > 0 ? "Select a user…" : "Everyone has access"}
          </option>
          {candidates.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="button primary"
          disabled={!selectedUserId || isDisabled}
        >
          Add
        </button>
      </div>
    </form>
  );
}

function PeopleWithAccess({
  access,
  isDisabled,
  onRemove,
}: {
  access: DocumentAccessResponse;
  isDisabled: boolean;
  onRemove: (user: PublicUser) => Promise<void>;
}) {
  return (
    <section>
      <h3>People with access</h3>
      <ul className="people-list" aria-label="People with access">
        <li>
          <PersonName user={access.owner} suffix=" (you)" />
          <span className="meta">Owner</span>
        </li>
        {access.people.map((user) => (
          <li key={user.id}>
            <PersonName user={user} />
            <button
              type="button"
              className="button"
              aria-label={`Remove ${user.displayName}`}
              disabled={isDisabled}
              onClick={() => onRemove(user)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonName({
  user,
  suffix = "",
}: {
  user: PublicUser;
  suffix?: string;
}) {
  return (
    <>
      <span className="avatar" aria-hidden="true">
        {user.displayName.charAt(0)}
      </span>
      <span className="person-name">
        {user.displayName}
        {suffix}
      </span>
    </>
  );
}

function useSharingDetails(documentId: string) {
  const [access, setAccess] = useState<DocumentAccessResponse | null>(null);
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDocumentAccess(documentId), listUsers()])
      .then(([loadedAccess, loadedUsers]) => {
        setAccess(loadedAccess);
        setUsers(loadedUsers);
      })
      .catch(() => setErrorMessage(LOAD_FAILED_MESSAGE));
  }, [documentId]);

  return { access, setAccess, users, errorMessage, setErrorMessage };
}

/** Users who could still be added: everyone except the owner and people who have access. */
function listCandidates(
  users: PublicUser[],
  access: DocumentAccessResponse,
): PublicUser[] {
  const peopleWithAccess = [access.owner, ...access.people];
  const takenIds = new Set(peopleWithAccess.map((user) => user.id));

  return users.filter((user) => !takenIds.has(user.id));
}

function removePerson(
  access: DocumentAccessResponse,
  userId: string,
): DocumentAccessResponse {
  const people = access.people.filter((user) => user.id !== userId);
  return { ...access, people };
}
