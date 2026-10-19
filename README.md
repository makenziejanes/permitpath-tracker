# PermitPath HQ

Daily plans, 8pm check-ins, goal skyline, wins wall, and check-in log for Makenzie and Collin.
Next.js on Vercel, Neon Postgres for shared data, web push for phone notifications.

Plan on about 20 minutes. You don't need to install anything on your computer.

## 1. Put the code on GitHub

1. Go to github.com and click **New repository**. Name it `permitpath-tracker` and set it to **Private**. Click **Create repository**.
2. On the next screen, click **uploading an existing file**.
3. Unzip `permitpath-tracker.zip`, open the folder, select everything inside it, and drag it onto the page. Click **Commit changes**.

## 2. Create the Vercel project

1. In Vercel, click **Add New → Project** and import `permitpath-tracker`.
2. Leave every setting as it is and click **Deploy**. The first deploy will load, but it will show an error until the database is connected. That's expected.

## 3. Connect the database

1. In the new project, open the **Storage** tab and click **Create Database**.
2. Choose **Neon** (Postgres) and the free plan, then connect it to this project.
3. This adds `DATABASE_URL` for you. The app creates its own tables the first time it loads.

## 4. Add the settings

In the project, go to **Settings → Environment Variables** and add these four. Copy the first two from `vapid-keys.txt`.

| Name | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | The public key from `vapid-keys.txt` |
| `VAPID_PRIVATE_KEY` | The private key from `vapid-keys.txt` |
| `VAPID_SUBJECT` | `mailto:` followed by your email, for example `mailto:makenzie@permitpath.com` |
| `TEAM_CODE` | A short code you two share. Anyone can view the dashboard, but only someone with this code can make changes. |

Then open **Deployments**, click the three dots on the latest deployment, and click **Redeploy**.

Once the keys are saved in Vercel, delete `vapid-keys.txt`. Never put the private key in GitHub.

## 5. Use team.permitpath.com

1. In the project, go to **Settings → Domains** and add `team.permitpath.com`.
2. Vercel will show one DNS record to add. If permitpath.com's DNS is already managed by Vercel, it adds the record itself.

## 6. Set up each phone

**iPhone (iOS 16.4 or later)**
1. Open team.permitpath.com in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open PermitPath from the home screen, pick your name, and enter the team code.
4. Tap the bell button, then **Turn on notifications**. A test notification should arrive.

**Android**
1. Open the site in Chrome and add it to the home screen when prompted.
2. Then follow steps 3 and 4 above.

## 7. Add your goals

On the skyline, tap **+ New goal**. Makenzie's 300 new contacts goes in the Sales District, Collin's goals go in the Product District, and shared goals go Downtown. Each goal needs a target number, a start date, and a deadline.

## For your instructor

- Share team.permitpath.com and tap **Just looking**. Viewing needs no code.
- The **Log** tab has **Export log (CSV)**, with every morning plan, 8pm check-in, blocker with its resolution date, and goal change.
- **Export items (CSV)** lists every planned item and whether it was done. Commitment scores are calculated from this file.

## How the numbers work

| Number | How it's calculated |
| --- | --- |
| Streak | Weekdays in a row on which both of you submitted an 8pm check-in. Weekends are skipped. Today only counts once you've both checked in. |
| Commitment score | Planned items done ÷ planned items, counting partner requests. Extras added at check-in don't count. A carried-over item counts once, in the week it was first planned. |
| Pace | A straight line from the goal's start date to its deadline. "3 days behind" means the count is where it should have been 3 days ago. |
| Partner requests | Appear at the top of your partner's list the next weekday morning. |

All dates use Mountain Time.

## Changing things later

- Brand colors are in `app/globals.css`, at the top under `:root`.
- The logo is a placeholder in `components/Badge.jsx`. Swap in the City Badge.
- App icons are `public/icon-192.png`, `public/icon-512.png`, and `public/apple-touch-icon.png`.
- Edit any file on GitHub and Vercel redeploys on its own.
