# lab-ecs-fargate-cd-infra

[![Build Status](https://apipipeline-codepipelinestatusbadgebucketec4c6a0a-wk8v4jsq0jfq.s3-ap-northeast-1.amazonaws.com/latest-build.svg#1)](https://ap-northeast-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/ApiPipeline-PipelineC660917D-CB103H1V09B8/view)

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

Modify [configs/lab.yml] to configure ECS.

The most important property is `desiredCount` which determines how many ECS Tasks should be run.
