# Scaling Guide

This document describes horizontal scaling setup and auto-scaling configuration for the Credibility Analyzer system.

## Overview

The Credibility Analyzer supports horizontal scaling to handle increased load. The architecture uses:
- Multiple backend API instances behind a load balancer
- Multiple ML service instances for inference workloads
- Redis for caching and session management
- MongoDB for persistent storage
- RabbitMQ/Bull for async job processing

## Horizontal Scaling Setup

### Backend API Scaling

The backend API service can be scaled horizontally using Docker Compose or container orchestration.

#### Docker Compose Scaling

Scale the API service using the `--scale` flag or environment variables:

```bash
# Scale to 3 API instances
docker-compose -f docker-compose.production.yml up -d --scale api=3

# Or set via environment variable
export API_REPLICAS=3
docker-compose -f docker-compose.production.yml up -d
```

#### Configuration

The production configuration supports the following scaling parameters:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_REPLICAS` | 3 | Number of backend API instances |
| `ML_REPLICAS` | 2 | Number of ML service instances |
| `ML_WORKERS` | 4 | Gunicorn workers per ML instance |

### Load Balancer Configuration

Nginx is configured as the load balancer with the following settings:

```nginx
upstream backend_servers {
    least_conn;                                    # Least connections algorithm
    server backend-1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server backend-2:3000 weight=1 max_fails=3 fail_timeout=30s;
    server backend-3:3000 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 32;                                  # Connection pooling
}
```

Key features:
- **Least connections algorithm**: Routes requests to the server with fewest active connections
- **Health checks**: Removes unhealthy instances after 3 failures within 30 seconds
- **Connection keepalive**: Maintains persistent connections for better performance

### ML Service Scaling

The ML service can be scaled independently:

```bash
# Scale ML service
export ML_REPLICAS=4
docker-compose -f docker-compose.production.yml up -d
```

For GPU deployments, use the GPU-enabled Dockerfile:

```bash
# Deploy with GPU support
docker-compose -f docker-compose.yml --profile gpu up -d
```



## Auto-Scaling Configuration

### Container Orchestration Auto-Scaling

For production deployments using Docker Swarm or Kubernetes, configure auto-scaling based on metrics.

#### Docker Swarm Mode

Deploy with auto-scaling using Docker Swarm:

```bash
# Initialize swarm
docker swarm init

# Deploy stack with replicas
docker stack deploy -c docker-compose.production.yml credibility
```

Update service replicas dynamically:

```bash
# Scale API service
docker service scale credibility_api=5

# Scale ML service
docker service scale credibility_ml-service=3
```

#### Kubernetes Horizontal Pod Autoscaler

For Kubernetes deployments, use HPA for automatic scaling:

```yaml
# hpa-api.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: credibility-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: credibility-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

Apply the HPA:

```bash
kubectl apply -f hpa-api.yaml
```

### AWS Auto Scaling (ECS/Fargate)

For AWS deployments, configure Application Auto Scaling:

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/credibility-cluster/api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy (target tracking)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/credibility-cluster/api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 300
  }'
```

### Scaling Thresholds

Recommended auto-scaling thresholds:

| Metric | Scale Up | Scale Down | Cooldown |
|--------|----------|------------|----------|
| CPU Utilization | > 70% | < 30% | 60s up / 300s down |
| Memory Utilization | > 80% | < 40% | 60s up / 300s down |
| Request Latency (p95) | > 500ms | < 100ms | 120s up / 300s down |
| Queue Depth | > 100 jobs | < 10 jobs | 30s up / 300s down |

### Resource Limits

Production resource limits per instance:

| Service | CPU Limit | Memory Limit | CPU Reserved | Memory Reserved |
|---------|-----------|--------------|--------------|-----------------|
| API | 1.0 | 1GB | 0.25 | 256MB |
| ML Service | 2.0 | 4GB | 0.5 | 1GB |
| Frontend | 0.5 | 256MB | 0.1 | 64MB |
| MongoDB | 2.0 | 4GB | 0.5 | 1GB |
| Redis | 1.0 | 1GB | 0.25 | 256MB |



## Database Scaling

### MongoDB Sharding Strategy

MongoDB sharding enables horizontal scaling for collections exceeding 100GB. The Credibility Analyzer uses sharding for the `analyses` collection.

#### Shard Key Strategy

The `analyses` collection uses a compound shard key for optimal distribution:

```javascript
// Shard key for analyses collection
{
  "createdAt": "hashed",
  "userId": 1
}
```

**Rationale:**
- `createdAt` (hashed): Ensures even distribution across shards and prevents hotspots from recent data
- `userId`: Enables efficient queries for user-specific analysis history

#### Sharding Setup

1. **Deploy Config Servers** (replica set of 3):

```bash
# Start config server replica set
mongod --configsvr --replSet configReplSet --port 27019 --dbpath /data/configdb
```

2. **Deploy Shard Servers** (minimum 2 shards, each a replica set):

```bash
# Shard 1 replica set
mongod --shardsvr --replSet shard1ReplSet --port 27018 --dbpath /data/shard1

# Shard 2 replica set
mongod --shardsvr --replSet shard2ReplSet --port 27020 --dbpath /data/shard2
```

3. **Deploy Query Routers** (mongos):

```bash
mongos --configdb configReplSet/config1:27019,config2:27019,config3:27019 --port 27017
```

4. **Enable Sharding**:

```javascript
// Connect to mongos
mongosh --port 27017

// Enable sharding for database
sh.enableSharding("credibility_prod")

// Create index for shard key
db.analyses.createIndex({ "createdAt": "hashed", "userId": 1 })

// Shard the collection
sh.shardCollection("credibility_prod.analyses", { "createdAt": "hashed", "userId": 1 })
```

#### Chunk Management

Configure chunk size and balancing:

```javascript
// Set chunk size (default 128MB, adjust based on workload)
use config
db.settings.updateOne(
  { _id: "chunksize" },
  { $set: { value: 64 } },
  { upsert: true }
)

// Enable balancer (runs during maintenance window)
sh.setBalancerState(true)

// Set balancer window (2 AM - 6 AM)
db.settings.updateOne(
  { _id: "balancer" },
  { $set: { activeWindow: { start: "02:00", stop: "06:00" } } },
  { upsert: true }
)
```

#### Migration Procedures

**Pre-Migration Checklist:**
1. Backup all data using `mongodump`
2. Verify sufficient disk space on all shards
3. Schedule maintenance window
4. Notify stakeholders

**Migration Steps:**

```bash
# 1. Create backup
mongodump --uri="mongodb://localhost:27017/credibility_prod" --out=/backup/pre-sharding

# 2. Deploy sharded cluster (config servers, shards, mongos)

# 3. Enable sharding and migrate data
mongosh --port 27017 << 'EOF'
sh.enableSharding("credibility_prod")
db.analyses.createIndex({ "createdAt": "hashed", "userId": 1 })
sh.shardCollection("credibility_prod.analyses", { "createdAt": "hashed", "userId": 1 })
EOF

# 4. Monitor migration progress
mongosh --port 27017 --eval "sh.status()"

# 5. Verify data integrity
mongosh --port 27017 --eval "db.analyses.countDocuments({})"
```



### Redis Cluster Setup

Redis Cluster provides high availability and horizontal scaling for caching and session management.

#### Cluster Architecture

Minimum configuration: 3 master nodes with 1 replica each (6 nodes total).

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Master 1   │    │  Master 2   │    │  Master 3   │
│  Slots 0-   │    │  Slots      │    │  Slots      │
│  5460       │    │  5461-10922 │    │  10923-16383│
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Replica 1  │    │  Replica 2  │    │  Replica 3  │
└─────────────┘    └─────────────┘    └─────────────┘
```

#### Cluster Deployment

1. **Create Redis Configuration Files**:

```bash
# redis-cluster.conf (for each node)
port 7000
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
appendonly yes
maxmemory 2gb
maxmemory-policy allkeys-lru
```

2. **Start Redis Nodes**:

```bash
# Start 6 Redis instances (3 masters + 3 replicas)
for port in 7000 7001 7002 7003 7004 7005; do
  mkdir -p /data/redis-$port
  redis-server --port $port \
    --cluster-enabled yes \
    --cluster-config-file /data/redis-$port/nodes.conf \
    --cluster-node-timeout 5000 \
    --appendonly yes \
    --dir /data/redis-$port \
    --daemonize yes
done
```

3. **Create Cluster**:

```bash
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

4. **Verify Cluster Status**:

```bash
redis-cli -p 7000 cluster info
redis-cli -p 7000 cluster nodes
```

#### Docker Compose Cluster Configuration

For containerized deployments:

```yaml
# docker-compose.redis-cluster.yml
version: '3.8'

services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis-node-1-data:/data
    networks:
      - redis-cluster

  redis-node-2:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis-node-2-data:/data
    networks:
      - redis-cluster

  redis-node-3:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis-node-3-data:/data
    networks:
      - redis-cluster

  redis-node-4:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis-node-4-data:/data
    networks:
      - redis-cluster

  redis-node-5:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis-node-5-data:/data
    networks:
      - redis-cluster

  redis-node-6:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis-node-6-data:/data
    networks:
      - redis-cluster

networks:
  redis-cluster:
    driver: bridge

volumes:
  redis-node-1-data:
  redis-node-2-data:
  redis-node-3-data:
  redis-node-4-data:
  redis-node-5-data:
  redis-node-6-data:
```

#### Application Configuration

Update the backend to connect to Redis Cluster:

```typescript
// Environment variables for Redis Cluster
REDIS_CLUSTER_MODE=true
REDIS_CLUSTER_NODES=redis-node-1:6379,redis-node-2:6379,redis-node-3:6379
```

```typescript
// Redis client configuration
import { createCluster } from 'redis';

const redisCluster = createCluster({
  rootNodes: [
    { url: 'redis://redis-node-1:6379' },
    { url: 'redis://redis-node-2:6379' },
    { url: 'redis://redis-node-3:6379' },
  ],
  defaults: {
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  },
});
```

#### Failover and Recovery

Redis Cluster handles automatic failover:

1. **Automatic Failover**: When a master fails, its replica is promoted automatically
2. **Manual Failover**: Force failover for maintenance

```bash
# Trigger manual failover on replica
redis-cli -p 7003 cluster failover

# Check cluster health
redis-cli -p 7000 cluster info | grep cluster_state
```

#### Monitoring

Monitor cluster health with these commands:

```bash
# Cluster status
redis-cli -p 7000 cluster info

# Node information
redis-cli -p 7000 cluster nodes

# Slot distribution
redis-cli -p 7000 cluster slots

# Memory usage per node
for port in 7000 7001 7002 7003 7004 7005; do
  echo "Node $port:"
  redis-cli -p $port info memory | grep used_memory_human
done
```

## Scaling Best Practices

1. **Monitor before scaling**: Use metrics to identify bottlenecks
2. **Scale gradually**: Add instances incrementally and monitor impact
3. **Test failover**: Regularly test failover procedures
4. **Document changes**: Keep scaling decisions and configurations documented
5. **Set alerts**: Configure alerts for resource utilization thresholds
6. **Plan capacity**: Forecast growth and plan scaling ahead of demand
