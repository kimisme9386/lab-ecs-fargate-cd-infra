import * as fs from 'fs';
import { App, Aws, Construct, Tags } from '@aws-cdk/core';
import * as yaml from 'js-yaml';
import { EcsFargate } from './ecs-fargate';
import { DeploymentType, Pipeline } from './pipeline';
import { RestAPINetwork } from './restapi-network';

enum Stage {
  LAB = 'lab',
  STAGING = 'staging',
  PROD = 'prod',
}

export interface StageConfig {
  Network: NetworkConfig;
  Ecs: EcsConfig;
  Deployment: DeploymentConfig;
}

export interface NetworkConfig {
  vpc: {
    maxAzs: number;
    natGateways: number;
    ipv6enabled: boolean;
  };
  alb: {
    listener: {
      certificateArn: string;
    };
    targetHealthCheck: {
      enabled: boolean;
      interval: number;
      path: string;
      timeout: number;
      healthyThresholdCount: number;
      unhealthyThresholdCount: number;
    };
    deregistrationDelay: number;
  };
}

interface EcsConfig {
  memoryLimitMiB: number;
  cpu: number;
  family: string;
  executionRoleArn: string;
  taskRole: {
    customManagedPolicies: string[];
  };
  container: {
    name: string;
    environment: {
      [key: string]: string;
    };
  };
  service: {
    desiredCount: number;
    minHealthyPercent: number;
    maxHealthyPercent: number;
    circuitBreakerRollback: boolean;
    assignPublicIp: boolean;
  };
}

interface DeploymentConfig {
  type: string;
  e2eTest: {
    ssm_postman_api_key: string;
    ssm_postman_collection_uid: string;
  };
}

function readConfig(stageName: string): any {
  return yaml.safeLoad(
    fs.readFileSync(`${__dirname}/../configs/${stageName}.yml`, 'utf8')
  );
}

function tagResource(scope: Construct): void {
  Tags.of(scope).add('CDK-CfnStackName', Aws.STACK_NAME);
}

const stage = process.env.STAGE || null;

if (stage === null || !Object.values(Stage).includes(stage as Stage)) {
  throw new Error('STAGE environment variable is required');
}

const stageConfig: StageConfig = readConfig(stage) as StageConfig;

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const restAPINetwork = new RestAPINetwork(app, 'ApiNetwork', {
  stageConfig,
  env: devEnv,
});

tagResource(restAPINetwork);

const ecsFargate = new EcsFargate(app, 'ApiApp', {
  stageConfig,
  vpc: restAPINetwork.vpc,
  alb: restAPINetwork.alb,
  env: devEnv,
});

tagResource(ecsFargate);

let blueGreenOptions = {};

if (stageConfig.Deployment.type == DeploymentType.BlueGreen) {
  blueGreenOptions = {
    blueGreenOptions: {
      prodTrafficListener: ecsFargate.prodTrafficListener,
      prodTargetGroup: ecsFargate.prodTargetGroup,
      testTrafficListener: ecsFargate.testTrafficListener,
      testTargetGroup: ecsFargate.testTargetGroup,
      taskDefinition: ecsFargate.taskDefinition,
    },
  };
}

new Pipeline(app, 'ApiPipeline', {
  stageConfig,
  fargateService: ecsFargate.service,
  ecrRepository: ecsFargate.ecrRepository,
  env: devEnv,
  ...blueGreenOptions,
});

// tagResource(pipeline);

ecsFargate.addDependency(restAPINetwork);

app.synth();
