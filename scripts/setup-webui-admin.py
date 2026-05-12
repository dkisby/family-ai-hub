#!/usr/bin/env python3
"""
Setup WebUI admin user from WEBUI_ADMIN_EMAIL environment variable.
Runs post-deployment to promote the admin email to admin role in OpenWebUI database.
"""
import sqlite3
import os
import sys
import time

def setup_admin():
    admin_email = os.environ.get('WEBUI_ADMIN_EMAIL')
    if not admin_email:
        print("ERROR: WEBUI_ADMIN_EMAIL environment variable not set")
        sys.exit(1)
    
    db_path = '/app/backend/data/webui.db'
    
    # Retry logic in case container is still starting
    max_retries = 30
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            
            # Check current users
            cur.execute('SELECT id, email, role FROM users')
            users = cur.fetchall()
            print(f"Current users in database: {users}")
            
            # Update admin email to admin role
            cur.execute("UPDATE users SET role='admin' WHERE email=?", (admin_email,))
            conn.commit()
            
            if cur.rowcount == 0:
                print(f"WARNING: No user found with email '{admin_email}'")
                print("User will be auto-created with admin role on first login via EasyAuth")
            else:
                print(f"✓ Promoted {cur.rowcount} user(s) to admin role")
            
            # Verify
            cur.execute('SELECT email, role FROM users')
            print("Updated users:")
            for row in cur.fetchall():
                print(f"  {row}")
            
            conn.close()
            print(f"✓ WebUI admin setup complete for: {admin_email}")
            return 0
            
        except sqlite3.OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Attempt {attempt + 1}/{max_retries}: Database not ready yet ({e}), retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                print(f"ERROR: Could not connect to database after {max_retries} attempts: {e}")
                sys.exit(1)
        except Exception as e:
            print(f"ERROR: {e}")
            sys.exit(1)

if __name__ == '__main__':
    sys.exit(setup_admin())
