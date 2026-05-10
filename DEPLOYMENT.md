# Testnexa AI — Deployment Guide

Complete guide to deploy Testnexa AI on Minikube with monitoring.

---

## Prerequisites

- [Docker Desktop](https://docs.docker.com/get-docker/) installed and running
- [Minikube](https://minikube.sigs.k8s.io/docs/start/) installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed

---

## 1. Start Minikube

```bash
minikube start --cpus=4 --memory=8192
```

---

## 2. Build Docker Images

### Option A: Build inside Minikube's Docker daemon (recommended for local dev)

```bash
# Point your shell to Minikube's Docker daemon
eval $(minikube docker-env)       # Linux/macOS
# OR for PowerShell:
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Build Frontend (from project root)
docker build -t testnexa-frontend:latest --build-arg VITE_API_BASE_URL=http://testnexa-backend-service:5000/api/v1 .

# Build Backend (from project root)
docker build -t testnexa-backend:latest ./backend
```

### Option B: Build and push to DockerHub (for production)

```bash
# Build and tag
docker build -t YOUR_DOCKERHUB_USER/testnexa-frontend:latest --build-arg VITE_API_BASE_URL=http://testnexa-backend-service:5000/api/v1 .
docker build -t YOUR_DOCKERHUB_USER/testnexa-backend:latest ./backend

# Push
docker push YOUR_DOCKERHUB_USER/testnexa-frontend:latest
docker push YOUR_DOCKERHUB_USER/testnexa-backend:latest
```

> **Note:** If pushing to DockerHub, update the `image:` field in `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml` to match your DockerHub image names.

---

## 3. Configure Secrets

Edit `k8s/secret.yaml` and replace placeholders with base64-encoded values:

```bash
# Example: encode your MongoDB URI
echo -n "mongodb+srv://user:pass@host/db" | base64

# Example: encode session secret
echo -n "your_session_secret" | base64
```

Replace each `REPLACE_WITH_BASE64_ENCODED_*` value in `k8s/secret.yaml`.

---

## 4. Deploy to Kubernetes

Apply the manifests in order:

```bash
# Step 1: Create namespace
kubectl apply -f k8s/namespace.yaml

# Step 2: ConfigMap and Secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# Step 3: Nginx config
kubectl apply -f k8s/nginx-configmap.yaml

# Step 4: Backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Step 5: Frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

---

## 5. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n testnexa

# Check services
kubectl get svc -n testnexa

# Check pod health
kubectl describe pod -n testnexa -l app=testnexa-backend

# View logs
kubectl logs -n testnexa -l app=testnexa-backend --tail=50
kubectl logs -n testnexa -l app=testnexa-frontend --tail=50
```

---

## 6. Access the Application

```bash
# Get the frontend URL (NodePort)
minikube service testnexa-frontend-service -n testnexa --url

# Or access directly via:
# http://<minikube-ip>:30080
minikube ip
```

---

## 7. Deploy Monitoring (Prometheus + Grafana)

```bash
# Apply all monitoring resources
kubectl apply -f k8s/monitoring/namespace.yaml
kubectl apply -f k8s/monitoring/prometheus-config.yaml
kubectl apply -f k8s/monitoring/prometheus-deployment.yaml
kubectl apply -f k8s/monitoring/grafana-deployment.yaml
```

### Access Prometheus

```bash
minikube service prometheus-service -n monitoring --url
# Or: http://<minikube-ip>:30090
```

### Access Grafana

```bash
minikube service grafana-service -n monitoring --url
# Or: http://<minikube-ip>:30030
# Login: admin / admin123
```

### Set Up Grafana Dashboards

1. Open Grafana → **Dashboards** → **Import**
2. Import these popular dashboards by ID:
   - **`3119`** — Kubernetes Cluster Monitoring (CPU, Memory, Pods)
   - **`6417`** — Kubernetes Cluster (Prometheus)
   - **`15661`** — Node Exporter Full
3. Select **Prometheus** as the data source

---

## 8. Useful Commands

```bash
# Scale backend replicas
kubectl scale deployment testnexa-backend -n testnexa --replicas=15

# Rolling update (after pushing new image)
kubectl rollout restart deployment testnexa-backend -n testnexa
kubectl rollout restart deployment testnexa-frontend -n testnexa

# Check rollout status
kubectl rollout status deployment testnexa-backend -n testnexa

# Delete everything
kubectl delete namespace testnexa
kubectl delete namespace monitoring
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Minikube Cluster                       │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Namespace: testnexa                                 │ │
│  │                                                     │ │
│  │  ┌──────────────────┐    ┌──────────────────────┐   │ │
│  │  │ Frontend (×4)    │    │ Backend (×10)         │   │ │
│  │  │ Nginx + React    │    │ Node.js + Express     │   │ │
│  │  │ Port: 80         │    │ Port: 5000            │   │ │
│  │  └────────┬─────────┘    └──────────┬───────────┘   │ │
│  │           │                          │               │ │
│  │  ┌────────▼─────────┐    ┌──────────▼───────────┐   │ │
│  │  │ NodePort :30080  │    │ ClusterIP :5000      │   │ │
│  │  │ (External)       │    │ (Internal only)      │   │ │
│  │  └──────────────────┘    └──────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Namespace: monitoring                               │ │
│  │                                                     │ │
│  │  ┌──────────────────┐    ┌──────────────────────┐   │ │
│  │  │ Prometheus       │    │ Grafana              │   │ │
│  │  │ NodePort :30090  │    │ NodePort :30030      │   │ │
│  │  └──────────────────┘    └──────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│                    ┌──────────────┐                       │
│                    │ MongoDB Atlas│ (External)            │
│                    └──────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

---

## Port Summary

| Service     | Type      | Internal Port | External Port |
|-------------|-----------|---------------|---------------|
| Frontend    | NodePort  | 80            | 30080         |
| Backend     | ClusterIP | 5000          | —             |
| Prometheus  | NodePort  | 9090          | 30090         |
| Grafana     | NodePort  | 3000          | 30030         |

---

## 9. AWS EKS Deployment (Production)

This section covers deploying the project to a production-ready AWS EKS cluster.

### Prerequisites (EKS)
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- An active AWS EKS cluster

### Step 1: Connect to EKS
Update your `kubeconfig` to point to your cluster:
```powershell
aws eks update-kubeconfig --region <region> --name <cluster-name>
```

### Step 2: Push Images to DockerHub
The EKS manifests are configured to use DockerHub images. Ensure your latest builds are pushed:
```powershell
docker push kishorgogoi2003/testnexa-frontend:latest
docker push kishorgogoi2003/testnexa-backend:latest
```

### Step 3: Deploy to EKS
Apply all manifests in the `k8s/` directory:
```powershell
kubectl apply -f k8s/
```

### Step 4: Verify Scaling & Networking
Check that 14 pods are running (10 backend, 4 frontend):
```powershell
kubectl get pods -n testnexa
```

Retrieve the LoadBalancer DNS name for the frontend:
```powershell
kubectl get svc testnexa-frontend-service -n testnexa
```
Copy the **EXTERNAL-IP** and open it in your browser.

### Key EKS Differences
- **LoadBalancer**: Unlike Minikube (NodePort), EKS uses a cloud LoadBalancer to provide a public URL.
- **Scaling**: Frontend replicas = 4, Backend replicas = 10 for high availability.
- **Health Probes**: Standardized to `/health` for both frontend and backend.
- **Resources**: EKS enforces the CPU/Memory limits defined in the manifests.
