# Deploy Coffee Ops MVP Permanently

This guide explains how to put the app online so it is not only running inside Codex or on your laptop.

## Best Hosting Recommendation

Use **Render** for the first live version.

Why Render is the best fit for this MVP:

- It can run this Python web app directly from GitHub.
- It supports persistent disks for saving local files across restarts and deploys.
- It is simpler for a small café operations app than managing your own server.
- You can set the Admin password and Staff PIN as private environment variables.

Important note: Render persistent disks are for paid web services. Without a persistent disk, uploaded files and saved submissions can be lost when the service restarts.

Alternative: **Railway** is also a good option. Railway supports Volumes, which provide persistent storage for services. Use Railway if you prefer its dashboard or already have an account there.

## What Is Already Prepared

The project now includes:

- `requirements.txt` for installing Excel support.
- `Procfile` for simple Python web service hosting.
- `render.yaml` for Render deployment with a persistent disk.
- `railway.json` for Railway deployment.
- `/health` endpoint for hosting health checks.
- Environment-variable support for:
  - `COFFEE_OPS_ADMIN_PASSWORD`
  - `COFFEE_OPS_STAFF_PIN`
  - `COFFEE_OPS_DATA_DIR`
- Persistent storage support using:
  - Render disk path: `/opt/render/project/src/storage`
  - Railway volume path from `RAILWAY_VOLUME_MOUNT_PATH`

## GitHub Setup

1. Create a GitHub account if you do not already have one.
2. Create a new private repository named something like `coffee-ops-mvp`.
3. Upload all project files from this folder to the repository.
4. Do not upload `.env` files or private passwords.

If you install GitHub Desktop, the easiest path is:

1. Open GitHub Desktop.
2. Choose “Add Existing Repository”.
3. Select this project folder.
4. Publish it as a private repository.

## Deploy on Render

1. Go to Render and sign in.
2. Create a new **Web Service**.
3. Connect your GitHub repository.
4. Choose the repository with this project.
5. Use these settings:
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `python server.py`
6. Add a persistent disk:
   - Disk name: `coffee-ops-data`
   - Mount path: `/opt/render/project/src/storage`
   - Size: `1 GB`
7. Add environment variables:
   - `COFFEE_OPS_DATA_DIR` = `/opt/render/project/src/storage`
   - `COFFEE_OPS_ADMIN_PASSWORD` = choose your real admin password
   - `COFFEE_OPS_STAFF_PIN` = choose your real staff PIN
8. Deploy the service.
9. Open the public Render URL.
10. Log in as Admin and test:
   - Dashboard
   - Language switch
   - Sales Excel/CSV upload
   - Issue status changes

## Deploy on Railway

1. Go to Railway and sign in.
2. Create a new project from GitHub.
3. Select this repository.
4. Add a Volume to the service.
5. Mount the volume to `/app/storage`.
6. Add environment variables:
   - `COFFEE_OPS_ADMIN_PASSWORD` = choose your real admin password
   - `COFFEE_OPS_STAFF_PIN` = choose your real staff PIN
7. Deploy the app.
8. Open the public Railway URL and test the same flows.

Railway automatically provides `RAILWAY_VOLUME_MOUNT_PATH` when a volume is attached. The app will use that path for saved submissions and uploads.

## After Going Live

Keep the MVP simple at first:

1. Use one Admin password.
2. Use one Staff PIN.
3. Add real branch names and inventory items in `data/config.json`.
4. Test with one real POS Excel/CSV file.
5. Check the dashboard daily.

## Backup Advice

For a real shop, do a simple weekly backup:

1. Download the persistent storage folder from the hosting dashboard or shell.
2. Save a copy somewhere safe.
3. Keep at least the last four weekly backups.

The important saved data is:

- `store.json`
- `uploads/`
- `config.json`

## Security Notes

This is still an MVP. It is good enough for a simple internal tool, but before using it for multiple shops or sensitive business data, upgrade:

- Individual user accounts
- Stronger password handling
- Database backups
- HTTPS-only access
- Better audit logs
