// CloudFront Function (viewer request) on the default behavior, which serves the React app from S3.
// Runtime constraint: this runs in CloudFront's own JavaScript runtime (cloudfront-js-2.0), not Node.
// It can't import anything, and the entry point must be a top-level function named "handler".
//
// App routes like /d/123 have no file in S3, so they are rewritten to /index.html and React Router
// takes over in the browser. Paths with a file extension (/assets/app.js) are left alone.
// /api/* never reaches this function: it has its own behavior that goes to the EC2 origin.

var APP_ENTRY_PAGE = "/index.html";

function hasFileExtension(uri) {
  var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
  return lastSegment.indexOf(".") !== -1;
}

// CloudFront calls handler() itself, so nothing in this file uses it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handler(event) {
  var request = event.request;

  if (!hasFileExtension(request.uri)) {
    request.uri = APP_ENTRY_PAGE;
  }

  return request;
}
