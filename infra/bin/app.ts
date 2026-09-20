#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { FastApiEcrStack } from "../lib/fastapi-ecr-stack";
import { FastApiEc2Stack } from "../lib/fastapi-ec2-stack";

const app = new cdk.App();

const env = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-southeast-2",
  },
};

new FastApiEcrStack(app, "FastApiEcrStack", env);
new FastApiEc2Stack(app, "FastApiEc2Stack", env);
