// Next 16 ships eslint-config-next as native flat configs — no FlatCompat.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    // Fence: the service-role client bypasses RLS. Only the server-only
    // privileged zone may import it. (v3.1 P0-12 / CI canary #2)
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/server/**", "src/app/api/cron/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/server/admin", "@/lib/server/admin"],
              message:
                "Service-role client bypasses RLS. Import it only inside src/lib/server or src/app/api/cron.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
