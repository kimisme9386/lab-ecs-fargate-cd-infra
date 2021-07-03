import { App } from '@aws-cdk/core';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { EcsFargate } from './ecs-fargate';
import { RestAPINetwork } from './restapi-network';

enum Stage {
  STAGING = 'staging',
  PROD = 'prod',
}

export interface StageConfig {
  Network: NetworkConfig;
  Ecs: EcsConfig;
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
  };
}

interface EcsConfig {
  ecrRepositoryName: string;
  memoryLimitMiB: number;
  cpu: number;
  executionRoleArn: string;
  taskRole: {
    customManagedPolicies: string[];
  };
  container: {
    environment: {
      [key: string]: string;
    };
    logGroupName: string;
  };
  service: {
    desiredCount: number;
    minHealthyPercent: number;
    maxHealthyPercent: number;
    circuitBreakerRollback: boolean;
  };
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

const restAPINetwork = new RestAPINetwork(app, 'api-network', {
  stageConfig,
  env: devEnv,
});

const ecsFargate = new EcsFargate(app, 'api-app', {
  stageConfig,
  vpc: restAPINetwork.vpc,
  alb: restAPINetwork.alb,
  env: devEnv,
});

ecsFargate.addDependency(restAPINetwork);

app.synth();

function readConfig(stageName: string): any {
  return yaml.safeLoad(
    fs.readFileSync(`${__dirname}/../configs/${stageName}.yml`, 'utf8')
  );
}
