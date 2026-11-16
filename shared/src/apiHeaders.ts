/**
 * Header the browser must send with file uploads. Plain HTML forms can't set custom
 * headers, and cross-site scripts can't send them without CORS approval, so this
 * keeps cross-site form posts (CSRF) out of the upload route, which accepts
 * multipart bodies instead of JSON.
 */
export const UPLOAD_REQUEST_HEADER = "X-Upload-Request";
