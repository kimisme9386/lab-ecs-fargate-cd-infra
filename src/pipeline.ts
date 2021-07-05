import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codePipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import { IRole } from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { CodePipelineStatus } from 'cdk-pipeline-status';

interface PipelineProps extends cdk.StackProps {
  fargateService: ecs.FargateService;
  ecrRepository: ecr.IRepository;
}

export class Pipeline extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    const pipeline = this.createCodePipeline();

    const sourceArtifact = new codePipeline.Artifact();

    this.addSourceStage(pipeline, sourceArtifact);

    const codebuildProject = this.createCodeBuildWithinCodePipeline(
      props.ecrRepository
    );
    const afterBuildArtifact = new codePipeline.Artifact();

    this.addBuildStage(
      pipeline,
      codebuildProject,
      sourceArtifact,
      afterBuildArtifact
    );

    this.addDeploymentStage(pipeline, props.fargateService, afterBuildArtifact);

    this.createPipelineStatus(pipeline);
  }

  addDeploymentStage(
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
    afterBuildArtifact: codePipeline.Artifact
  ) {
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'AWS_CodeBuild',
          input: sourceArtifact,
          project: codebuildProject,
          type: codepipeline_actions.CodeBuildActionType.BUILD,
          outputs: [afterBuildArtifact],
        }),
      ],
    });
  }

  createCodeBuildWithinCodePipeline(ecrRepository: ecr.IRepository) {
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
                'echo Logging in to Amazon ECR...',
                '$(aws ecr get-login --region $AWS_DEFAULT_REGION --no-include-email)',
                'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                'IMAGE_TAG=${COMMIT_HASH:=latest}',
              ],
            },
            build: {
              commands: [
                'cd ./flask.d',
                'docker build -t $REPOSITORY_URI:$IMAGE_TAG .',
              ],
            },
            post_build: {
              commands: [
                'docker push $REPOSITORY_URI:$IMAGE_TAG',
                'printf [{"name":"lab-ecs-fargate-codedeploy","imageUri":"%s"}] $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
              ],
            },
          },
          artifacts: {
            files: ['imagedefinitions.json'],
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
        },
        cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
      }
    );

    ecrRepository.grantPullPush(codeBuild.role as IRole);

    return codeBuild;
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
