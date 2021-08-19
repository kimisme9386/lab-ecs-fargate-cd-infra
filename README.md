# lab-ecs-fargate-cd-infra

Build CodePipeline to implement two approach of deployment on AWS CDK.

- [ECS rolling update](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)

- [ECS Blue/Green deployment with CodeDeploy](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-bluegreen.html)
  - Leverage [@cloudcomponents/cdk-blue-green-container-deployment](https://github.com/cloudcomponents/cdk-constructs) CDK construct to create CodeDeploy Deployment Group

> Notice: This project is not CDK Construct which is CDK App for lab

## Introduction

Include three stacks

- ApiNetwork - Vpc, Alb, Subnet and so on...

- ApiApp - ECS cluster, ECS Service, ECS Task Definitions, ECR and so on...

- ApiPipeline - CodePipeline, CodeBuild

Web App for ECS

- Using Python [Flask](https://github.com/pallets/flask) Web Framework
- In [flask.d](flask.d) root directory

Support two approach of deployment

- Two valid value of Deployment.type is `RollingUpdate` or `BlueGreen`

E2E testing when choosing BlueGreen deployment

- Use newman (postman cli) to test on [BeforeAllowTraffic of AppSpec 'hooks' section](https://docs.aws.amazon.com/codedeploy/latest/userguide/reference-appspec-file-structure-hooks.html#appspec-hooks-ecs)
- Specify postman api-key and collection uid in [configs/lab.yml](configs/lab.yml)

## Usage

Modify [configs/lab.yml](configs/lab.yml) to configure ECS.

The most important property is `desiredCount` which determines how many ECS Tasks should be run.

> :warning: Notice: desiredCount should be set 0 when first cdk deploy because ECR container image of ECS task hasn't be created yet.

Two demo configurations

- [ecs-private-ip-through-nat.yml](configs/ecs-private-ip-through-nat.yml) use private subnet on ECS Service and use NAT Gateway to connect internet.

- [ecs-public-ip.yml](configs/ecs-public-ip.yml) use public subnet on ECS and assign public ip to connect internet directly.

Both the two configurations accept traffic from ALB.
