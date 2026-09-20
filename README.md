# FastAPI EC2 Starter

Starter API ready to run manually on an AWS EC2 instance. It includes a Docker image, Compose configuration, a health endpoint, environment-based CORS, and an Nginx reverse-proxy template.

## Infrastructure as code

The AWS CDK TypeScript stack is in [`infra/`](infra/README.md). It creates the VPC, public subnet, security group, EC2 instance, and the same Nginx/systemd deployment automatically.

## Run locally

```bash
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`. Run checks with:

```bash
pytest
```

Or use Docker:

```bash
cp .env.example .env
docker compose up --build -d
curl http://127.0.0.1:8000/health
```

## Manual EC2 deployment (Docker + Nginx)

These instructions target Ubuntu 22.04/24.04. In the EC2 security group, allow inbound TCP **22** only from your IP and TCP **80/443** from the internet. Do not expose port 8000: Compose binds it to localhost only.

1. Connect and install Docker/Nginx:

   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose-plugin nginx
   sudo systemctl enable --now docker nginx
   sudo usermod -aG docker $USER
   exit
   ```

   SSH in again after the `usermod` command.

2. Copy the project to the server, then configure and start it:

   ```bash
   git clone YOUR_REPOSITORY_URL fastapi-ec2-starter
   cd fastapi-ec2-starter
   cp .env.example .env
   nano .env
   docker compose up --build -d
   docker compose ps
   curl http://127.0.0.1:8000/health
   ```

3. Enable Nginx. Replace `YOUR_DOMAIN_OR_EC2_PUBLIC_IP` in `deploy/nginx/fastapi-ec2.conf`, then:

   ```bash
   sudo cp deploy/nginx/fastapi-ec2.conf /etc/nginx/sites-available/fastapi-ec2
   sudo ln -s /etc/nginx/sites-available/fastapi-ec2 /etc/nginx/sites-enabled/fastapi-ec2
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl reload nginx
   ```

   Visit `http://YOUR_DOMAIN_OR_EC2_PUBLIC_IP/health` and `http://YOUR_DOMAIN_OR_EC2_PUBLIC_IP/docs`.

4. For HTTPS, point a domain's DNS A record to the instance public IP, then run:

   ```bash
   sudo snap install --classic certbot
   sudo certbot --nginx -d api.example.com
   ```

## Updating manually

```bash
cd fastapi-ec2-starter
git pull
docker compose up --build -d
docker image prune -f
```

Useful diagnostics:

```bash
docker compose logs -f api
docker compose ps
sudo journalctl -u nginx -f
```

## Add endpoints

Put new routers under `app/` and import them in `app/main.py`. Keep secrets in `.env` on the EC2 instance; it is intentionally ignored by Git.
# fastapi-ec2
