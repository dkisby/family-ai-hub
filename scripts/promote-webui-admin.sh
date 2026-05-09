#!/bin/bash

set -e

ADMIN_EMAIL="${1:-dkisby@gmail.com}"
RESOURCE_GROUP="${2:-rg-family-ai-hub}"
CONTAINER_APP="${3:-webui-family-hub}"

echo "Promoting WebUI admin: $ADMIN_EMAIL"
echo "  Container App: $CONTAINER_APP"
echo "  Resource Group: $RESOURCE_GROUP"
echo ""
PYTHON_CMD='
import sqlite3, time, sys
admin_email = "'$ADMIN_EMAIL'"
db_path = "/app/backend/data/webui.db"
print(f"Setting up admin for {admin_email}...")

for attempt in range(10):
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT email, role FROM users WHERE email=?", (admin_email,))
        existing = cur.fetchone()
        
        if existing:
            print(f"  Before: {existing}")
        else:
            print(f"  User {admin_email} not yet in database")
        cur.execute("UPDATE users SET role='\''admin'\'' WHERE email=?", (admin_email,))
        conn.commit()
        print(f"  Updated {cur.rowcount} user(s) to admin role")
        cur.execute("SELECT email, role FROM users WHERE email=?", (admin_email,))
        updated = cur.fetchone()
        
        if updated:
            print(f"  After:  {updated}")
        cur.execute("SELECT email, role FROM users")
        print("\n  All users in database:")
        for row in cur.fetchall():
            print(f"    {row}")
        
        conn.close()
        print(f"\n✓ Admin promotion complete for {admin_email}")
        break
        
    except sqlite3.OperationalError as e:
        if attempt < 9:
            print(f"  Attempt {attempt + 1}/10: Database not ready, retrying...")
            time.sleep(2)
        else:
            print(f"  ERROR: Could not connect to database: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
'
az containerapp exec \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_APP" \
  --command "python3 -c '$PYTHON_CMD'" || {
    echo ""
    echo "ERROR: Failed to run admin promotion"
    echo ""
    echo "Manual alternative:"
    echo "  az containerapp exec"
    echo "    --resource-group $RESOURCE_GROUP"
    echo "    --name $CONTAINER_APP"
    echo "    --command python3"
    echo "  Then paste:"
    echo "    import sqlite3; c=sqlite3.connect('/app/backend/data/webui.db'); c.execute(\"UPDATE users SET role='admin' WHERE email='$ADMIN_EMAIL'\"); c.commit(); c.close(); print('Done')"
    exit 1
  }

echo ""
echo "✓ Verify admin access in WebUI settings"
