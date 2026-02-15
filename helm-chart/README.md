# Essential Invoice Helm Chart

A Helm chart for deploying Essential Invoice on Kubernetes — a self-hosted invoicing application for Czech freelancers.

## Prerequisites

- Kubernetes 1.24+
- Helm 3.x
- PV provisioner (for PostgreSQL persistence)

## Installation

### Add dependency and install

```bash
cd helm-chart
helm dependency update
helm install essential-invoice . \
  --namespace essential-invoice \
  --create-namespace \
  --set jwtSecret=$(openssl rand -base64 32) \
  --set postgresql.auth.password=$(openssl rand -base64 16)
```

### Using a values file

```bash
helm install essential-invoice . \
  --namespace essential-invoice \
  --create-namespace \
  -f my-values.yaml
```

## Uninstall

```bash
helm uninstall essential-invoice -n essential-invoice
```

> **Note**: The PostgreSQL PVC is not deleted on uninstall. Delete it manually if needed:
> `kubectl delete pvc -l app.kubernetes.io/instance=essential-invoice -n essential-invoice`

## Configuration Reference

### Backend

| Parameter | Description | Default |
|---|---|---|
| `backend.image.repository` | Backend image | `ghcr.io/vdovhanych/essential-invoice/backend` |
| `backend.image.tag` | Image tag | `latest` |
| `backend.replicas` | Number of replicas | `1` |
| `backend.port` | Container port | `3001` |
| `backend.resources.requests.memory` | Memory request | `128Mi` |
| `backend.resources.requests.cpu` | CPU request | `100m` |
| `backend.resources.limits.memory` | Memory limit | `512Mi` |
| `backend.resources.limits.cpu` | CPU limit | `500m` |
| `backend.env.NODE_ENV` | Node environment | `production` |
| `backend.env.EMAIL_POLLING_INTERVAL` | Email polling interval (ms) | `300000` |

### Frontend

| Parameter | Description | Default |
|---|---|---|
| `frontend.image.repository` | Frontend image | `ghcr.io/vdovhanych/essential-invoice/frontend` |
| `frontend.image.tag` | Image tag | `latest` |
| `frontend.replicas` | Number of replicas | `1` |
| `frontend.port` | Container port | `80` |
| `frontend.resources.requests.memory` | Memory request | `64Mi` |
| `frontend.resources.requests.cpu` | CPU request | `50m` |
| `frontend.resources.limits.memory` | Memory limit | `256Mi` |
| `frontend.resources.limits.cpu` | CPU limit | `200m` |

### Ingress

| Parameter | Description | Default |
|---|---|---|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.host` | Hostname | `""` |
| `ingress.tls` | TLS configuration | `[]` |

### Secrets

| Parameter | Description | Default |
|---|---|---|
| `jwtSecret` | JWT signing secret (required) | `""` |
| `existingSecret` | Use existing secret (keys: `JWT_SECRET`, `DB_PASSWORD`) | `""` |

### PostgreSQL (Bitnami subchart)

| Parameter | Description | Default |
|---|---|---|
| `postgresql.enabled` | Deploy PostgreSQL subchart | `true` |
| `postgresql.auth.database` | Database name | `essential_invoice` |
| `postgresql.auth.username` | Username | `postgres` |
| `postgresql.auth.password` | Password (required) | `""` |
| `postgresql.auth.existingSecret` | Existing secret for DB password | `""` |
| `postgresql.primary.persistence.enabled` | Enable PVC | `true` |
| `postgresql.primary.persistence.size` | PVC size | `5Gi` |

### External Database

To use an external database instead of the subchart:

```yaml
postgresql:
  enabled: false
  external:
    host: my-postgres.example.com
    port: 5432
    database: essential_invoice
    username: postgres
    password: my-password
```

## Examples

### With ingress and TLS (nginx + cert-manager)

```yaml
jwtSecret: "my-jwt-secret"

ingress:
  enabled: true
  className: nginx
  host: invoice.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
  tls:
    - secretName: essential-invoice-tls
      hosts:
        - invoice.example.com

postgresql:
  auth:
    password: "my-db-password"
  primary:
    persistence:
      size: 10Gi
```

### Using existing secrets

```bash
# Create the secret manually
kubectl create secret generic essential-invoice-creds \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=DB_PASSWORD=my-db-password \
  -n essential-invoice

# Reference it in values
helm install essential-invoice . \
  --set existingSecret=essential-invoice-creds \
  --set postgresql.auth.existingSecret=essential-invoice-creds \
  -n essential-invoice
```
