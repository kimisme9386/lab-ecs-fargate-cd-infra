import * as path from 'path';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codePipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as iam from '@aws-cdk/aws-iam';
import { IRole } from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { EcsDeploymentGroup } from '@cloudcomponents/cdk-blue-green-container-deployment';
import { CodePipelineStatus } from 'cdk-pipeline-status';
import { StageConfig } from './main';

export enum DeploymentType {
  RollingUpdate = 'RollingUpdate',
  BlueGreen = 'BlueGreen',
}

interface PipelineProps extends cdk.StackProps {
  stageConfig: StageConfig;
  fargateService: ecs.FargateService;
  ecrRepository: ecr.IRepository;
  blueGreenOptions?: BlueGreenOptions;
}

interface BlueGreenOptions {
  prodTrafficListener: elbv2.ApplicationListener;
  prodTargetGroup: elbv2.ApplicationTargetGroup;
  testTrafficListener: elbv2.ApplicationListener;
  testTargetGroup: elbv2.ApplicationTargetGroup;
  taskDefinition?: ecs.FargateTaskDefinition;
}

export class Pipeline extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    const pipeline = this.createCodePipeline();

    const sourceArtifact = new codePipeline.Artifact();

    this.addSourceStage(pipeline, sourceArtifact);

    let codebuildProject: codebuild.PipelineProject | undefined;

    if (props.stageConfig.Deployment.type == DeploymentType.RollingUpdate) {
      codebuildProject = this.createRollingUpdateCodeBuildWithinCodePipeline(
        props.ecrRepository,
        props.stageConfig.Ecs.container.name
      );
    } else if (props.stageConfig.Deployment.type == DeploymentType.BlueGreen) {
      codebuildProject = this.createBlueGreenCodeBuildWithinCodePipeline(
        props.ecrRepository,
        props.stageConfig.Ecs.container.name
      );

      this.createDeploymentHooksLambda();
    }

    if (codebuildProject == undefined) {
      throw new Error(
        'props.stageConfig.Deployment.type is required or the type value is invalid.'
      );
    }

    const imageArtifact = new codePipeline.Artifact();
    let manifestArtifact = null;

    if (props.stageConfig.Deployment.type == DeploymentType.BlueGreen) {
      manifestArtifact = new codePipeline.Artifact();
    }

    this.addBuildStage(
      pipeline,
      codebuildProject,
      sourceArtifact,
      imageArtifact,
      manifestArtifact
    );

    if (props.stageConfig.Deployment.type == DeploymentType.RollingUpdate) {
      this.addRollingUpdateDeploymentStage(
        pipeline,
        props.fargateService,
        imageArtifact
      );
    } else if (props.stageConfig.Deployment.type == DeploymentType.BlueGreen) {
      if (!props.blueGreenOptions) {
        throw new Error(
          'blueGreenOptions is required when using blueGreen Type.'
        );
      }
      this.addBlueGreenDeploymentStage(
        props.blueGreenOptions,
        pipeline,
        props.fargateService,
        imageArtifact,
        manifestArtifact as codePipeline.Artifact
      );
    }

    this.createPipelineStatus(pipeline);
  }

  addBlueGreenDeploymentStage(
    blueGreenOptions: BlueGreenOptions,
    pipeline: codePipeline.Pipeline,
    fargateService: ecs.FargateService,
    imageArtifact: codePipeline.Artifact,
    manifestArtifact: codePipeline.Artifact
  ) {
    const deploymentGroup = new EcsDeploymentGroup(this, 'DeploymentGroup', {
      applicationName: 'ecs-blue-green-application',
      deploymentGroupName: 'ecs-blue-green-deployment-group',
      ecsServices: [
        {
          clusterName: fargateService.cluster.clusterName,
          serviceName: fargateService.serviceName,
        },
      ],
      targetGroupNames: [
        blueGreenOptions.prodTargetGroup.targetGroupName,
        blueGreenOptions.testTargetGroup.targetGroupName,
      ],
      prodTrafficListener: {
        listenerArn: blueGreenOptions.prodTrafficListener.listenerArn,
      },
      testTrafficListener: {
        listenerArn: blueGreenOptions.testTrafficListener.listenerArn,
      },
      terminationWaitTimeInMinutes: 100,
    });

    pipeline.addStage({
      stageName: 'DeploymentByCodeDeploy',
      actions: [
        new codepipeline_actions.CodeDeployEcsDeployAction({
          actionName: 'EcsCodeDeployBlueGreen',
          deploymentGroup: deploymentGroup,
          taskDefinitionTemplateInput: manifestArtifact,
          appSpecTemplateInput: manifestArtifact,
          containerImageInputs: [
            {
              input: imageArtifact,
              taskDefinitionPlaceholder: 'IMAGE1_NAME',
            },
          ],
        }),
      ],
    });
  }

  addRollingUpdateDeploymentStage(
    pipeline: codePipeline.Pipeline,
    fargateService: ecs.FargateService,
    afterBuildArtifact: codePipeline.Artifact
  ) {
    pipeline.addStage({
      stageName: 'Deployment',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'EcsCodeDeployRollingUpdate',
          service: fargateService,
          imageFile: afterBuildArtifact.atPath('imagedefinitions.json'),
        }),
      ],
    });
  }

  createECSCodeDeployRole(): iam.Role {
    const role = new iam.Role(this, 'CodeDeployECSRole', {
      assumedBy: new iam.ServicePrincipal(
        `codedeploy.${cdk.Aws.REGION}.amazonaws.com`
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'),
      ],
    });

    return role;
  }

  createPipelineStatus(pipeline: codePipeline.Pipeline) {
    const codePipelineStatus = new CodePipelineStatus(
      this,
      'CodePipelineStatus',
      {
        pipelineArn: pipeline.pipelineArn,
        gitHubTokenFromSecretsManager: {
          secretsManagerArn:
            'arn:aws:secretsmanager:ap-northeast-1:482631629698:secret:codepipeline/lambda/github-token-YWWmII',
          secretKey: 'codepipeline/lambda/github-token',
        },
      }
    );

    new cdk.CfnOutput(this, 'BadgeUrl', {
      value: codePipelineStatus.badgeUrl,
    });

    new cdk.CfnOutput(this, 'CodePipelineLink', {
      value: codePipelineStatus.codePipelineLink,
    });
  }

  addBuildStage(
    pipeline: codePipeline.Pipeline,
    codebuildProject: codebuild.PipelineProject,
    sourceArtifact: codePipeline.Artifact,
    imageArtifact: codePipeline.Artifact,
    manifestArtifact: codePipeline.Artifact | null
  ) {
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'AWS_CodeBuild',
          input: sourceArtifact,
          project: codebuildProject,
          type: codepipeline_actions.CodeBuildActionType.BUILD,
          outputs:
            manifestArtifact == null
              ? [imageArtifact]
              : [imageArtifact, manifestArtifact],
        }),
      ],
    });
  }

  createRollingUpdateCodeBuildWithinCodePipeline(
    ecrRepository: ecr.IRepository,
    ecsContainerName: string
  ) {
    const codeBuild = new codebuild.PipelineProject(
      this,
      'CodeBuildWithinCodePipeline',
      {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          env: {
            shell: 'bash',
          },
          phases: {
            pre_build: {
              commands: [
                'codebuild-breakpoint # Ref https://docs.aws.amazon.com/codebuild/latest/userguide/session-manager.html',
                'echo Logging in to Amazon ECR...',
                '$(aws ecr get-login --region $AWS_DEFAULT_REGION --no-include-email)',
                'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                'IMAGE_TAG=${COMMIT_HASH:=latest}',
              ],
            },
            build: {
              'on-failure': 'ABORT',
              'commands': [
                'cd ./flask.d',
                'docker build -t $REPOSITORY_URI:latest .',
                'docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG',
                'cd ../',
              ],
            },
            post_build: {
              commands: [
                'echo Build completed on $(date)',
                'echo Pushing the Docker images...',
                'docker push $REPOSITORY_URI:latest',
                'docker push $REPOSITORY_URI:$IMAGE_TAG',
                'printf \'[{"name":"%s","imageUri":"%s"}]\' $ECS_CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
              ],
            },
          },
          artifacts: {
            files: 'imagedefinitions.json',
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
          computeType: codebuild.ComputeType.SMALL,
          privileged: true,
        },
        environmentVariables: {
          REPOSITORY_URI: {
            value: ecrRepository.repositoryUri,
          },
          ECS_CONTAINER_NAME: {
            value: ecsContainerName,
          },
        },
        cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
      }
    );

    ecrRepository.grantPullPush(codeBuild.role as IRole);

    return codeBuild;
  }

  createBlueGreenCodeBuildWithinCodePipeline(
    ecrRepository: ecr.IRepository,
    ecsContainerName: string
  ) {
    const codeBuild = new codebuild.PipelineProject(
      this,
      'CodeBuildWithinCodePipeline',
      {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          env: {
            shell: 'bash',
          },
          phases: {
            pre_build: {
              commands: [
                'codebuild-breakpoint # Ref https://docs.aws.amazon.com/codebuild/latest/userguide/session-manager.html',
                'echo Logging in to Amazon ECR...',
                '$(aws ecr get-login --region $AWS_DEFAULT_REGION --no-include-email)',
                'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                'IMAGE_TAG=${COMMIT_HASH:=latest}',
              ],
            },
            build: {
              'on-failure': 'ABORT',
              'commands': [
                'cd ./flask.d',
                'docker build -t $REPOSITORY_URI:latest .',
                'docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG',
                'cd ../',
              ],
            },
            post_build: {
              commands: [
                'echo Build completed on $(date)',
                'echo Pushing the Docker images...',
                'docker push $REPOSITORY_URI:latest',
                'docker push $REPOSITORY_URI:$IMAGE_TAG',
                'printf \'[{"ImageURI":"%s"}]\' $ECS_CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imageDetail.json',
              ],
            },
          },
          artifacts: {
            'files': ['imageDetail.json'],
            'secondary-artifacts': {
              manifest: {
                files: ['taskdef.json', 'appspec.yaml'],
              },
            },
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
          computeType: codebuild.ComputeType.SMALL,
          privileged: true,
        },
        environmentVariables: {
          REPOSITORY_URI: {
            value: ecrRepository.repositoryUri,
          },
          ECS_CONTAINER_NAME: {
            value: ecsContainerName,
          },
        },
        cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
      }
    );

    ecrRepository.grantPullPush(codeBuild.role as IRole);

    return codeBuild;
  }

  createDeploymentHooksLambda() {
    new lambda.DockerImageFunction(this, 'BlueGreenDeploymentHook', {
      functionName: 'BlueGreenDeploymentHook',
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '../deployment-hooks')
      ),
      environment: {
        REGION: cdk.Aws.REGION,
        DEBUG: 'true',
      },
    });
  }

  addSourceStage(
    pipeline: codePipeline.Pipeline,
    sourceArtifact: codePipeline.Artifact
  ) {
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub_Source',
          owner: 'kimisme9386',
          repo: 'lab-ecs-fargate-cd-infra',
          output: sourceArtifact,
          connectionArn:
            'arn:aws:codestar-connections:ap-northeast-1:482631629698:connection/6a6dd11d-2713-4129-9e5d-23289c8968d6',
          variablesNamespace: 'GitHubSourceVariables',
          branch: 'main',
          codeBuildCloneOutput: true,
        }),
      ],
    });
  }

  createCodePipeline() {
    return new codePipeline.Pipeline(this, 'Pipeline', {
      crossAccountKeys: false,
    });
  }
}
