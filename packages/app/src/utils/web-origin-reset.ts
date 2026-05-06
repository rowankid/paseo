const RESET_QUERY_PARAM = "resetPaseo";
const ATTACHMENT_DB_NAME = "paseo-attachment-bytes";

type ResetWindow = Pick<Window, "location" | "localStorage"> & {
  indexedDB?: IDBFactory;
};

function clearIndexedDb(windowLike: ResetWindow): void {
  try {
    windowLike.indexedDB?.deleteDatabase(ATTACHMENT_DB_NAME);
  } catch (error) {
    console.warn("[WebReset] Failed to clear attachment database", error);
  }
}

function clearLocalStorage(windowLike: ResetWindow): void {
  try {
    windowLike.localStorage.clear();
  } catch (error) {
    console.warn("[WebReset] Failed to clear local storage", error);
  }
}

export function consumeWebOriginResetRequest(windowLike: ResetWindow | undefined): boolean {
  if (!windowLike) {
    return false;
  }

  const url = new URL(windowLike.location.href);
  if (url.searchParams.get(RESET_QUERY_PARAM) !== "1") {
    return false;
  }

  clearLocalStorage(windowLike);
  clearIndexedDb(windowLike);

  url.searchParams.delete(RESET_QUERY_PARAM);
  windowLike.location.replace(url.toString());
  return true;
}
