import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

export class FastApiEcrStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repository = new ecr.Repository(this, "Repository", {
      repositoryName: "fastapi-ec2",
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });
    repository.addLifecycleRule({ maxImageCount: 10, description: "Keep the ten newest images" });

    new cdk.CfnOutput(this, "RepositoryUri", { value: repository.repositoryUri });
    new cdk.CfnOutput(this, "RepositoryName", { value: repository.repositoryName });
  }
}
