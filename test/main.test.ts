import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { App } from '@aws-cdk/core';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Pipeline } from '../src//pipeline';
import { EcsFargate } from '../src/ecs-fargate';
import { StageConfig } from '../src/main';
import {} from '../src/pipeline';
import { RestAPINetwork } from '../src/restapi-network';

test('Snapshot', () => {
  process.env.STAGE = 'lab';

  const stageConfig: StageConfig = yaml.safeLoad(
    fs.readFileSync(`${__dirname}/../configs/${process.env.STAGE}.yml`, 'utf8')
  ) as StageConfig;

  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };

  const app = new App();
  const stackNetwork = new RestAPINetwork(app, 'testStack1', {
    env,
    stageConfig,
  });

  const stackFargate = new EcsFargate(app, 'testStack2', {
    vpc: stackNetwork.vpc,
    alb: stackNetwork.alb,
    env,
    stageConfig,
  });

  const pipeline = new Pipeline(app, 'ApiPipeline', {
    fargateService: stackFargate.service,
    ecrRepository: stackFargate.ecrRepository,
    env,
  });

  expect(SynthUtils.toCloudFormation(stackNetwork)).toMatchSnapshot();
  expect(SynthUtils.toCloudFormation(stackFargate)).toMatchSnapshot();
  expect(SynthUtils.toCloudFormation(pipeline)).toMatchSnapshot();
});
