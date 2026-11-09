// Check headers you already send, offline, with the codes HMRC's Test API uses.
import { validateFraudPreventionHeaders } from "hmrc-fraud-prevention-headers";

const result = validateFraudPreventionHeaders({
  "gov-client-connection-method": "DESKTOP_APP_VIA_SERVER",
  "gov-client-screens": "width=1920&height=1080",
  "gov-client-timezone": "GMT",
  "gov-vendor-version": "my-desktop-app=2.2.2",
});

console.log(result.code);
const missing = (result.errors ?? []).filter((e) => e.code === "MISSING_HEADER");
console.log(`${missing.length} headers missing for DESKTOP_APP_VIA_SERVER`);
for (const issue of [...(result.errors ?? []), ...(result.warnings ?? [])]) {
  if (issue.code !== "MISSING_HEADER")
    console.log(`${issue.code} ${issue.headers.join(", ")}: ${issue.message}`);
}
