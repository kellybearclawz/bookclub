# Connecting the "Add a Book" form to your site — one-time setup

This gets you to the point where filling out the form on your site commits a
new row to your CSV on GitHub, with no login required after today.

Three parts: a scoped GitHub token, a free Cloudflare Worker, and plugging
the two into the form.

---

## Part 1 — Create a scoped GitHub token (~2 min)

1. Go to **github.com → Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**.
2. Name it something like `bookclub-worker`.
3. **Repository access:** choose "Only select repositories" → pick
   `kellybearclawz/bookclub`. (Don't grant access to all repos — this token
   should only ever be able to touch this one.)
4. **Permissions:** under "Repository permissions," set **Contents** to
   **Read and write**. Leave everything else as "No access."
5. Set an expiration (or "No expiration" if you'd rather not renew it —
   your call).
6. Generate it and **copy the token now** — GitHub only shows it once.

---

## Part 2 — Deploy the Cloudflare Worker (~5 min)

1. Go to **dash.cloudflare.com** and sign up free if you don't have an
   account (no credit card needed for the free tier).
2. In the sidebar: **Workers & Pages → Create → Create Worker**. Give it a
   name like `bookclub-add-book` and deploy the starter.
3. Click **Edit code**. Delete the placeholder code and paste in the
   contents of `worker.js` (the file I gave you alongside this guide). Click
   **Deploy**.
4. Go to the Worker's **Settings → Variables and Secrets**. Add these,
   marking each as **Secret** (encrypted):
   | Name | Value |
   |---|---|
   | `GITHUB_TOKEN` | the token from Part 1 |
   | `SHARED_SECRET` | make up a password — anything long and random works |

   These are optional and only needed if your setup differs from the
   defaults already in the file:
   | Name | Value |
   |---|---|
   | `OWNER` | `kellybearclawz` |
   | `REPO` | `bookclub` |
   | `FILE_PATH` | `Book Club - Books Read_ISBN.csv` |
   | `BRANCH` | `main` (change to `master` if that's your repo's default branch) |

5. Save. Your Worker now lives at a URL like
   `https://bookclub-add-book.<your-subdomain>.workers.dev` — copy that, you'll
   need it next.

That's it for the backend. From here, nothing here needs touching again
unless you rotate the token.

---

## Part 3 — Connect the form

1. Open `add-book.html` (the form I built) in your browser, or add it as a
   page in your bookclub repo so it lives on your site alongside the rest.
2. Click the **Settings** (gear) icon in the top corner.
3. Paste in:
   - **Worker URL** — the `workers.dev` address from Part 2
   - **Shared secret** — the password you set as `SHARED_SECRET`
4. Save. The form remembers these in your browser going forward, so you
   only enter them once per device.
5. Fill out a test book and submit. You should see a confirmation stamp,
   and within a few seconds a new commit will appear on your GitHub repo
   with a message like `Add "Book Title" by Author`.

If your live site reads the CSV at page-load (client-side), the new book
shows up immediately on refresh. If your site is built by GitHub Pages from
the CSV (a Jekyll-style build), it'll appear after Pages finishes its
rebuild — usually under a minute.

---

## A couple of notes

- **Don't publish the Worker URL or shared secret anywhere public** —
  anyone with both could add rows to your file. Since it's just for you,
  keeping them in the form's local settings (never committed to the repo)
  is enough.
- **The GitHub token only has write access to this one repo's file
  contents** — even in the worst case, nothing else in your GitHub account
  is exposed.
- If you ever want to revoke access, delete the token in GitHub — the
  Worker will simply stop being able to write, no other cleanup needed.
- Want edit/delete-from-the-form too, not just add? I can extend the Worker
  for that next — just say the word.
