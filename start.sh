#!/bin/bash

# Starts Jupyter Lab in the background
# --ip 0.0.0.0 is required for external access to the container
# --allow-root is required if running as root
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --notebook-dir=/home/jupyter/work --NotebookApp.token='' --NotebookApp.password=''  --log-level=ERROR&


# Starts Uvicorn (the main process that keeps the container alive)
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
