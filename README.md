# Coffee Ops MVP

A simple internal operations system for a specialty coffee shop.

It includes:

- Mobile-friendly staff forms for daily checklist, inventory count, and issues
- Admin dashboard for checklist status, missing submissions, inventory changes, issues, sales uploads, and weekly summary
- Persistent file storage for saved submissions and uploads
- Editable sample setup in `data/config.json`
- POS sales upload for `.xlsx`, `.xlsm`, and `.csv` files
- Arabic and English interface
- Simple Admin and Staff login roles

## How to run

Use the bundled Python runtime if you are running inside Codex:

```bash
/Users/sankhalaqi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 server.py
```

Or use your own Python environment if it has `openpyxl` installed:

```bash
python3 server.py
```

Then open:

```text
http://127.0.0.1:8000
```

## Permanent deployment

See `DEPLOYMENT.md` for GitHub, Render, Railway, and persistent storage instructions.

## How to use

1. Sign in as staff or admin.
2. Staff can submit an opening or closing checklist, daily inventory count, and shortages/issues.
3. Admin can open the protected dashboard, upload POS sales files, review all submissions, and update issue status.
4. Use the Arabic / English button to switch language. Arabic uses right-to-left layout.

Demo access:

- Staff PIN: `2468`
- Admin password: `admin123`

You can change these before starting the server:

```bash
COFFEE_OPS_STAFF_PIN=1234 COFFEE_OPS_ADMIN_PASSWORD=your-password python3 server.py
```

## Editing labels and sample items

Most operational labels are in:

```text
app/translations.js
```

Operational setup is in:

```text
data/config.json
```

You can edit:

- Branch names
- Checklist tasks
- Inventory items and units
- Issue types

Restart the server or refresh the browser after editing.

## POS upload format

Sample upload files are included here:

- `outputs/sample-pos-sales.xlsx`
- `outputs/sample-pos-sales.csv`

The upload parser looks for common column names, including:

- Product, Item, or Name
- Category or Department
- Quantity or Qty
- Total, Sales, Amount, Net Sales, or Gross Sales
- Order ID, Receipt, Ticket, or Invoice

The exact POS export can be adjusted later once you know the real column names.

## First-version limits

- This MVP uses simple file storage, not a full production database.
- It uses one Admin password and one Staff PIN.
- Bar photo upload saves a preview in the local JSON file for MVP simplicity.
- Sales and inventory comparison is basic and can be improved once product-to-inventory mapping is defined.
