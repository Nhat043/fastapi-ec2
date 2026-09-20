import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class FastApiEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const keyPairName = new cdk.CfnParameter(this, "KeyPairName", {
      type: "AWS::EC2::KeyPair::KeyName",
      description: "Existing EC2 key-pair name; its private .pem file stays on your machine.",
    });

    const sshAllowedCidr = new cdk.CfnParameter(this, "SshAllowedCidr", {
      type: "String",
      description: "Your public IP in CIDR form, for example 203.0.113.10/32.",
      allowedPattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}/(?:[0-9]|[12][0-9]|3[0-2])$",
      constraintDescription: "Must be an IPv4 CIDR, such as 203.0.113.10/32.",
    });

    const imageTag = new cdk.CfnParameter(this, "ImageTag", {
      type: "String",
      default: "v1",
      description: "Immutable ECR image tag to run, for example v1.",
      allowedPattern: "^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$",
    });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, "WebSecurityGroup", {
      vpc,
      description: "FastAPI public HTTP and administrator SSH access",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.ipv4(sshAllowedCidr.valueAsString), ec2.Port.tcp(22), "SSH from administrator IP");
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Public HTTP");

    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Allows EC2 to pull the FastAPI image from Amazon ECR",
    });
    instanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"));
    const instanceProfile = new iam.CfnInstanceProfile(this, "InstanceProfile", { roles: [instanceRole.roleName] });

    const repositoryUri = cdk.Fn.join("", [
      cdk.Aws.ACCOUNT_ID,
      ".dkr.ecr.",
      cdk.Aws.REGION,
      ".amazonaws.com/fastapi-ec2",
    ]);
    const imageUri = cdk.Fn.join("", [repositoryUri, ":", imageTag.valueAsString]);

    const instance = new ec2.CfnInstance(this, "Instance", {
      imageId: "{{resolve:ssm:/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id}}",
      instanceType: "t3.micro",
      keyName: keyPairName.valueAsString,
      subnetId: vpc.publicSubnets[0].subnetId,
      securityGroupIds: [securityGroup.securityGroupId],
      iamInstanceProfile: instanceProfile.ref,
      userData: cdk.Fn.base64(userData(imageUri)),
      tags: [{ key: "Name", value: "fastapi-ec2-cdk" }],
    });

    new cdk.CfnOutput(this, "PublicIp", { value: instance.attrPublicIp });
    new cdk.CfnOutput(this, "SwaggerUrl", { value: cdk.Fn.join("", ["http://", instance.attrPublicIp, "/docs"]) });
  }
}

function userData(imageUri: string): string {
  return `#!/bin/bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y awscli docker.io nginx
systemctl enable --now docker

aws ecr get-login-password --region ${cdk.Aws.REGION} | docker login --username AWS --password-stdin ${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com
docker pull ${imageUri}
docker run --detach --name fastapi-ec2 --restart unless-stopped --publish 127.0.0.1:8000:8000 ${imageUri}

cat >/etc/nginx/sites-available/fastapi-ec2 <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/fastapi-ec2 /etc/nginx/sites-enabled/fastapi-ec2
rm -f /etc/nginx/sites-enabled/default
systemctl enable --now nginx
nginx -t
systemctl reload nginx
`;
}
