# AWS CDK infrastructure

This CDK TypeScript app creates and deploys the API using ECR:

- one private Amazon ECR repository for the FastAPI Docker image;
- one VPC with one public subnet, Internet Gateway, and public route;
- one `t3.micro` Ubuntu 24.04 EC2 instance;
- a security group allowing HTTP from anywhere and SSH only from the CIDR you provide;
- an EC2 IAM role with only ECR pull permissions;
- EC2 user data that pulls the chosen ECR image, starts it with Docker restart policy, and places Nginx in front of it.

It intentionally creates no NAT Gateway (which costs money). The ECR repository uses immutable tags and keeps only the ten newest images. It is configured for deletion including images during `cdk destroy`, which is convenient for a lab; use `RETAIN` for a production image registry.

## One-time workstation setup

Configure AWS CLI credentials for the AWS account and Sydney region, then install CDK dependencies:

```bash
cd infra
npm install
npx cdk bootstrap aws://ACCOUNT_ID/ap-southeast-2
```

The bootstrap command creates CDK deployment resources once per account/region.

## Create the registry and push an image

Deploy the registry first. This does not create EC2:

```bash
npx cdk deploy FastApiEcrStack
```

Copy the `RepositoryUri` output, then authenticate Docker, build, tag, and push an immutable image tag. Replace `REPOSITORY_URI` with that output.

```bash
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com
docker build -t fastapi-ec2:v1 ..
docker tag fastapi-ec2:v1 REPOSITORY_URI:v1
docker push REPOSITORY_URI:v1
```

Amazon ECR requires Docker to authenticate with `aws ecr get-login-password` before pushing. [AWS documentation](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)

## Preview and deploy EC2

Find your current public IP, then use `/32` as the SSH CIDR. `KeyPairName` is the existing EC2 key-pair name from the AWS console, not a path to its `.pem` file.

```bash
npx cdk synth
npx cdk diff
npx cdk deploy FastApiEc2Stack \
  --parameters FastApiEc2Stack:KeyPairName=YOUR_KEY_PAIR_NAME \
  --parameters FastApiEc2Stack:SshAllowedCidr=YOUR.PUBLIC.IP/32 \
  --parameters FastApiEc2Stack:ImageTag=v1
```

CDK outputs the public IP and Swagger URL. Wait two or three minutes for EC2 user data to finish, then open the Swagger URL. The EC2 role is granted ECR read-only access so it can pull the image without storing ECR credentials on the instance.

## Remove all billable resources

```bash
npx cdk destroy FastApiEc2Stack FastApiEcrStack
```

Confirm the destruction prompt. The CDK bootstrap stack may remain; its S3 bucket is normally empty and inexpensive, but can also be removed separately if you no longer use CDK in this account/region.
