import { APP_NAME } from "../brand";

export function BrandMark() {
  return (
    <div className="brand">
      <span className="brand-logo" aria-hidden="true" />
      {APP_NAME}
    </div>
  );
}
