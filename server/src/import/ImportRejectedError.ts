/** Thrown when an uploaded file can't become a document. The route answers with `status` and the message. */
export class ImportRejectedError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ImportRejectedError";
    this.status = status;
  }
}
