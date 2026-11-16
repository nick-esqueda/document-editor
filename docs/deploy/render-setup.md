# Render setup (one time)

Puts Ajaia Doc Editor online at https://ajaia.nickesqueda.com. It takes about 15 minutes, mostly waiting for the first build. After this, every push to `main` redeploys on its own.

`render.yaml` in the repo root describes everything Render creates:

| What                                  | Render name        | Plan               | Cost     |
| ------------------------------------- | ------------------ | ------------------ | -------- |
| Web service (API + React app, Docker) | `ajaia-doc-editor` | Starter, Ohio      | $7/month |
| Postgres 16                           | `ajaia-db`         | Basic 256 MB, Ohio | $6/month |

## Steps

1. **Merge the deploy PR into `main`.** Render builds from `main`.
2. **Sign in to Render** at https://dashboard.render.com with GitHub. Add a payment method under **Billing**, since both plans are paid.
3. **Create the Blueprint:** click **New +** → **Blueprint**. Connect GitHub if asked, and give Render access to `nick-esqueda/document-editor`. Pick that repo and branch `main`. Name the Blueprint `ajaia`, check that it lists `ajaia-doc-editor` and `ajaia-db`, then click **Apply**.
4. **Wait for the first deploy** (5-10 minutes). Under **ajaia-doc-editor → Events**, it should end with "Deploy live". The logs show `Migrations up: done`, `Seeded users: alice, bob, carol` and `API listening`.
5. **Check the Render URL:** open the `https://ajaia-doc-editor….onrender.com` link at the top of the service page. You should see the login page.
6. **Get the demo password:** **ajaia-doc-editor → Environment** → `SEED_PASSWORD` → click the eye icon. It's the password for alice, bob and carol. Render generated it, and it isn't stored anywhere else.
7. **Add the DNS record** where nickesqueda.com's DNS is managed:

   | Type  | Host / Name | Value / Points to                                                       |
   | ----- | ----------- | ----------------------------------------------------------------------- |
   | CNAME | `ajaia`     | The service's `….onrender.com` hostname from step 5, without `https://` |

8. **Verify the domain:** **ajaia-doc-editor → Settings → Custom Domains**. `ajaia.nickesqueda.com` is already listed from `render.yaml`. Click **Verify**. The certificate is issued automatically, usually within a few minutes of the DNS record resolving.
9. **Open https://ajaia.nickesqueda.com** and log in as `alice` with the password from step 6.

## Day-to-day

| Task                       | How                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Deploy a change            | Merge or push to `main`. Render builds and switches over once `/` passes the health check.  |
| See logs                   | **ajaia-doc-editor → Logs**                                                                 |
| Roll back                  | **ajaia-doc-editor → Events** → pick an earlier deploy → **Rollback**                       |
| Change the demo password   | **Environment** → edit `SEED_PASSWORD` → **Save and deploy**. The seed applies it on start. |
| Database backups / restore | **ajaia-db → Recovery** (Render's managed backups and point-in-time recovery)               |

Don't change `SESSION_SECRET` unless you want to log everyone out.
