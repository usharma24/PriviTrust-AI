import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import engine, Base, SessionLocal
from backend.models.models import User
from backend.seed_db import seed
from ml.isolation_forest import train_model

# Import routes
from backend.routes import auth_routes, user_routes, action_routes, monitoring_routes, audit_routes

app = FastAPI(
    title="PriviTrust AI Backend API",
    description="Continuous Identity Trust Framework for Privileged Access Security",
    version="1.0.0"
)

# Configure CORS for React frontend (development server defaults to port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(action_routes.router)
app.include_router(monitoring_routes.router)
app.include_router(audit_routes.router)

@app.on_event("startup")
def on_startup():
    print("Executing startup routine...")
    # 1. Initialize tables (creates privitrust.db SQLite file)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # 2. Check if DB needs seeding (check if any users exist)
        user_count = db.query(User).count()
        if user_count == 0:
            print("Database is empty. Executing seed script...")
            seed()
        else:
            print("Database already contains data. Skipping seeding.")
            
        # 3. Train the behavioral profiling model on startup
        print("Initializing Machine Learning behavioral model...")
        db.close()
        db = SessionLocal()
        train_success = train_model(db)
        if train_success:
            print("Behavioral profiling model loaded and ready.")
        else:
            print("Warning: Behavioral profiling model training skipped or failed.")
            
    except Exception as e:
        print(f"Error during startup initialization: {e}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PriviTrust AI Framework",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
