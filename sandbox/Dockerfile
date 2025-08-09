FROM python:3.11-alpine
RUN pip install --no-cache-dir fastapi uvicorn docker
WORKDIR /app
COPY service.py /app/service.py
EXPOSE 8080
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8080"]
