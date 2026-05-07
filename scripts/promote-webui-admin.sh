#!/bin/bash
# Promote WebUI admin user by email

set -e

ADMIN_EMAIL="${1:-dkisby@gmail.com}"
RESOURCE_GROUP="${2:-rg-family-ai-hub}"
CONTAINER_APP="${3:-webui-family-hub}"

echo "Promoting WebUI admin: $ADMIN_EMAIL"
echo "  Container App: $CONTAINER_APP"
echo "  Resource Group: $RESOURCE_GROUP"

# Create a temporary script file on local machine
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'PYTHON_SCRIPT'
import sqlite3
import time
import sys

admin_email = sys.argv[1]
db_path = '/app/backend/data/webui.db'

print(f"Setting up admin for {admin_email}...")

for attempt in range(10):
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        
        # Check current
        cur.execute('SELECT email, role FROM users WHERE email=?', (admin_email,))
        existing = cur.fetchone()
        
        if existing:
            print(f"Before: {existing}")
        
        # Promote
        cur.execute("UPDATE users SET role='admin' WHERE email=?", (admin_email,))
        conn.commit()
        
        # Verify
        cur.execute('SELECT email, role FROM users WHERE email=?', (admin_email,))
        updated = cur.fetchone()
        
        if updated:
            print(f"After:  {updated}")
            print(f"✓ Admin promotion complete for {admin_email}")
        else:
            print(f"User {admin_email} not found in database")
            print("Note: User will be auto-created on first EasyAuth login")
        
        # Show all users
        cur.execute('SELECT email, role FROM users')
        print("\nAll users in database:")
        for row in cur.fetchall():
            print(f"  {row}")
        
        conn.close()
        sys.exit(0)
        
    except sqlite3.OperationalError as e:
        if attempt < 9:
            print(f"Attempt {attempt + 1}/10: Database not ready, retrying...")
            time.sleep(2)
        else:
            print(f"ERROR: Could not connect to database: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
PYTHON_SCRIPT

# Execute in container via az CLI
az containerapp exec \
  --resource-group "$RESOURCE_GROUP" \
  --name "$CONTAINER_APP" \
  --command "python3 /tmp/admin_setup.py '$ADMIN_EMAIL'" \
  < "$TEMP_SCRIPT" || {
    echo ""
    echo "Alternative: Run this manually in the container:"
    echo "  az containerapp exec --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --command 'python3'"
    rm -f "$TEMP_SCRIPT"
    exit 1
  }

rm -f "$TEMP_SCRIPT"
echo ""
echo "✓ Done! Check WebUI to verify admin access."
