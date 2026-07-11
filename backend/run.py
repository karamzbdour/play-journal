import uvicorn

if __name__ == "__main__":
    print("Starting Play-Journal FastAPI backend server...")
    print("REST Endpoints available at: http://localhost:8000")
    print("Interactive API docs: http://localhost:8000/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
