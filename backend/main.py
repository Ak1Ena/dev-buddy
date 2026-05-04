from fastapi import FastAPI

app = FastAPI(title="devBuddy API")

@app.get("/")
async def root():
    return {"message": "Welcome to devBuddy API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
