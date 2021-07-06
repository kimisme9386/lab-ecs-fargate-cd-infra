import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as logs from '@aws-cdk/aws-logs';
import * as cdk from '@aws-cdk/core';
import { NetworkConfig, StageConfig } from './main';

interface EcsFargateProps extends cdk.StackProps {
  stageConfig: StageConfig;
  readonly vpc?: ec2.Vpc;
  readonly alb?: elbv2.IApplicationLoadBalancer;
}

export class EcsFargate extends cdk.Stack {
  readonly service: ecs.FargateService;
  readonly ecrRepository: ecr.Repository;

  constructor(scope: cdk.Construct, id: string, props: EcsFargateProps) {
    super(scope, id, props);

    this.ecrRepository = new ecr.Repository(this, 'Repository', {
      repositoryName: props.stageConfig.Ecs.ecrRepositoryName,
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc:
        props?.vpc ??
        ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true }),
    });

    const fargateTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      'TaskDef',
      {
        memoryLimitMiB: props.stageConfig.Ecs.memoryLimitMiB,
        cpu: props.stageConfig.Ecs.cpu,
      }
    );

    fargateTaskDefinition.addContainer(props.stageConfig.Ecs.container.name, {
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository),
      environment: props.stageConfig.Ecs.container.environment,
      portMappings: [{ containerPort: 80, hostPort: 80 }],
      logging: ecs.LogDriver.awsLogs({
        logGroup: new logs.LogGroup(this, 'EcsLogGroup', {
          logGroupName: props.stageConfig.Ecs.container.logGroupName,
        }),
        streamPrefix: 'ecs',
      }),
    });

    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: fargateTaskDefinition,
      desiredCount: props.stageConfig.Ecs.service.desiredCount,
      circuitBreaker: {
        rollback: props.stageConfig.Ecs.service.circuitBreakerRollback,
      },
      minHealthyPercent: props.stageConfig.Ecs.service.minHealthyPercent,
      maxHealthyPercent: props.stageConfig.Ecs.service.maxHealthyPercent,
      healthCheckGracePeriod: cdk.Duration.seconds(0),
      assignPublicIp: true,
    });

    if (props?.alb) {
      this.createAlbListenerAndTargetGroup(
        props.alb,
        this.service,
        props.stageConfig.Network
      );
    }
  }

  private createAlbListenerAndTargetGroup(
    alb: elbv2.IApplicationLoadBalancer,
    service: ecs.FargateService,
    networkProps: NetworkConfig
  ): void {
    const listener = new elbv2.ApplicationListener(this, 'AlbListener', {
      loadBalancer: alb,
      port: 443,
      sslPolicy: elbv2.SslPolicy.RECOMMENDED,
    });

    if (networkProps.alb?.listener?.certificateArn) {
      listener.addCertificates('AlbListenerCertification', [
        {
          certificateArn: networkProps.alb.listener.certificateArn,
        },
      ]);
    }

    new elbv2.ApplicationListenerRule(this, 'AlbListenerRule', {
      listener: listener,
      priority: 10,
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'application/json',
        messageBody: '',
      }),
      conditions: [elbv2.ListenerCondition.pathPatterns(['/status'])],
    });

    listener.addTargets('ECS', {
      port: 80,
      targets: [service],
      healthCheck: {
        enabled: networkProps.alb.targetHealthCheck.enabled,
        interval: cdk.Duration.seconds(
          networkProps.alb.targetHealthCheck.interval
        ),
        path: networkProps.alb.targetHealthCheck.path,
        timeout: cdk.Duration.seconds(
          networkProps.alb.targetHealthCheck.timeout
        ),
        healthyThresholdCount:
          networkProps.alb.targetHealthCheck.healthyThresholdCount,
        unhealthyThresholdCount:
          networkProps.alb.targetHealthCheck.unhealthyThresholdCount,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(
        networkProps.alb.deregistrationDelay
      ),
    });
  }
}
