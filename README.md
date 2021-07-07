# lab-ecs-fargate-cd-infra

Build CodePipeline to implement [ECS rolling update](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) on AWS CDK.

> Notice: This project is not CDK Construct which is CDK App for lab

## Introduction

Contains three stacks

- ApiNetwork - Vpc, Alb, Subnet and so on...

- ApiApp - ECS cluster, ECS Service, ECS Task Definitions, ECR and so on...

- ApiPipeline - CodePipeline, CodeBuild

Web App for ECS

- Using Python [Flask](https://github.com/pallets/flask) Web Framework
- In [flask.d](flask.d) root directory

## Usage

Modify [configs/lab.yml](configs/lab.yml) to configure ECS.

The most important property is `desiredCount` which determines how many ECS Tasks should be run.

> Notice: desiredCount should be set 0 when first cdk deploy because ECR container image of ECS task hasn't be created yet.

Two demo configurations

- [ecs-private-ip-through-nat.yml](configs/ecs-private-ip-through-nat.yml) use private subnet on ECS Service and use NAT Gateway to connect internet.

- [ecs-public-ip.yml](configs/ecs-public-ip.yml) use public subnet on ECS and assign public ip to connect internet directly.

Both the two configurations accept traffic from ALB.
