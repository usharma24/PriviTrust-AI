import os
import sys
import random
from datetime import datetime, timedelta

# Ensure backend package can be imported if running script directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine, Base
from backend.models.models import User, Device, AuditLog

# Simple placeholder password hashing if passlib is not imported yet,
# but we will use passlib's CryptContext standard when we run.
import bcrypt

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def seed():
    print("Recreating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding users...")
        users_data = [
            {"name": "Security Administrator", "email": "security_admin@privitrust.com", "password": "AdminPassword123!", "role": "admin"},
            {"name": "Alice Support", "email": "alice_support@privitrust.com", "password": "AlicePassword123!", "role": "privileged_user"},
            {"name": "Bob Auditor", "email": "bob_auditor@privitrust.com", "password": "BobPassword123!", "role": "privileged_user"},
            {"name": "Charlie Engineer", "email": "charlie_engineer@privitrust.com", "password": "CharliePassword123!", "role": "privileged_user"}
        ]

        users = []
        for ud in users_data:
            user = User(
                name=ud["name"],
                email=ud["email"],
                password_hash=get_password_hash(ud["password"]),
                role=ud["role"]
            )
            db.add(user)
            db.flush()  # populate ID
            users.append(user)
            print(f"Created user: {user.email} (Role: {user.role})")

        # Map users
        admin_user = users[0]
        alice = users[1]
        bob = users[2]
        charlie = users[3]

        print("Seeding trusted devices...")
        devices_data = [
            {"user_id": alice.id, "fingerprint": "alice_macbook_chrome_fingerprint", "score": 98.0},
            {"user_id": bob.id, "fingerprint": "bob_windows_edge_fingerprint", "score": 95.0},
            {"user_id": charlie.id, "fingerprint": "charlie_linux_firefox_fingerprint", "score": 99.0}
        ]

        for dd in devices_data:
            device = Device(
                user_id=dd["user_id"],
                device_fingerprint=dd["fingerprint"],
                device_trust_score=dd["score"]
            )
            db.add(device)
            print(f"Registered device for user {dd['user_id']}: {dd['fingerprint']}")

        print("Generating 7-day baseline history for ML behavior training...")
        # We need to generate 100+ actions per user representing normal work behaviors.
        # Normal behaviors:
        # - Business hours (09:00 to 17:59)
        # - Weekdays (Monday to Friday)
        # - Low to medium severity actions (e.g., viewing profiles, editing tickets)
        # - Accessing 1 to 5 resource counts
        # - Trusted devices only

        actions_pool = {
            "privileged_user": [
                {"type": "Access Customer Profile", "severity": 0, "desc": "Viewed customer profile ID {id}"},
                {"type": "Search Account Transactions", "severity": 1, "desc": "Searched bank account transactions for ID {id}"},
                {"type": "Edit Support Ticket", "severity": 0, "desc": "Updated support ticket status for ticket {id}"},
                {"type": "Verify Customer Identity", "severity": 1, "desc": "Verified customer security details for ID {id}"},
                {"type": "Generate Audit Report", "severity": 2, "desc": "Generated audit logs report for department {id}"}
            ]
        }

        start_date = datetime.utcnow() - timedelta(days=7)
        total_seeded = 0

        # Seed for alice, bob, charlie
        for user in [alice, bob, charlie]:
            # Register device footprint to know what's normal for this user
            if user == alice:
                dev_fp = "alice_macbook_chrome_fingerprint"
            elif user == bob:
                dev_fp = "bob_windows_edge_fingerprint"
            else:
                dev_fp = "charlie_linux_firefox_fingerprint"

            print(f"Generating normal actions for {user.name}...")
            # Generate 110 logs spread over the last 7 days
            for i in range(110):
                # Ensure time is in business hours (9 AM - 5 PM)
                hour = random.randint(9, 17)
                minute = random.randint(0, 59)
                
                # Ensure date is weekday (Mon-Fri)
                day_offset = random.randint(0, 6)
                log_time = start_date + timedelta(days=day_offset)
                # If weekend, shift to weekday
                if log_time.weekday() >= 5:
                    log_time = log_time - timedelta(days=2)
                
                log_time = log_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                action = random.choice(actions_pool["privileged_user"])
                resource_id = random.randint(1000, 9999)
                desc = action["desc"].format(id=resource_id)
                
                # Low risk score for standard actions
                risk_score = float(random.randint(5, 25))

                audit_log = AuditLog(
                    user_id=user.id,
                    event_type=action["type"],
                    event_description=desc,
                    risk_score=risk_score,
                    timestamp=log_time
                )
                db.add(audit_log)
                total_seeded += 1

        db.commit()
        print(f"Database seeded successfully! Total {total_seeded} normal baseline logs created.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed()
