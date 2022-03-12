import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';

import { StageConfig } from './main';

interface RestAPINetworkProps extends cdk.StackProps {
  stageConfig: StageConfig;
}``

export class RestAPINetwork extends cdk.Stack {
  vpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: cdk.Construct, id: string, props: RestAPINetworkProps) {
    super(scope, id, props);

    const subnetConfiguration = [
      {
        cidrMask: 24,
        name: 'ingress',
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: 28,
        name: 'rds',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    ];

    if (props.stageConfig.Network.vpc.natGateways != 0) {
      subnetConfiguration.push({
        cidrMask: 24,
        name: 'application',
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      });
    }

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: props.stageConfig.Network.vpc.maxAzs,
      natGateways: props.stageConfig.Network.vpc.natGateways,
      subnetConfiguration: subnetConfiguration,
    });

    new ec2.InterfaceVpcEndpoint(this, 'VPCEndpointForECRApi', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.ap-northeast-1.ecr.api', 443),
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      privateDnsEnabled: true,
    });

    new ec2.InterfaceVpcEndpoint(this, 'VPCEndpointForECRDkr', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.ap-northeast-1.ecr.dkr', 443),
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      privateDnsEnabled: true,
    });

    new ec2.InterfaceVpcEndpoint(this, 'VPCEndpointForCW', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.ap-northeast-1.logs', 443),
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      privateDnsEnabled: true,  
    });

    new ec2.InterfaceVpcEndpoint(this, 'VPCEndpointForSecretManager', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.ap-northeast-1.secretsmanager', 443),
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      privateDnsEnabled: true,
    });

    new ec2.InterfaceVpcEndpoint(this, 'VPCEndpointForSSM', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.ap-northeast-1.ssm', 443),
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      privateDnsEnabled: true, 
    });

    new ec2.InterfaceVpcEndpoint(this, 'VPCEndpointForSSMMessage', {
      vpc: this.vpc,
      service: new ec2.InterfaceVpcEndpointService('com.amazonaws.ap-northeast-1.ssmmessages', 443),
      subnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
      },
      privateDnsEnabled: true, 
    });

    const s3GatewayEndpoint = this.vpc.addGatewayEndpoint('VpcS3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c']
        }
      ],
    });

    s3GatewayEndpoint.addToPolicy(new iam.PolicyStatement(
      {
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:GetObject'],
        resources: ['arn:aws:s3:::prod-region-starport-layer-bucket/*']
      }
    ));

    if (props.stageConfig.Network.vpc.ipv6enabled) this.enableIpv6(this.vpc);

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: this.vpc,
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.DUAL_STACK,
      vpcSubnets: this.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
    });
  }

  enableIpv6(vpc: ec2.Vpc) {
    const cfnIpv6Cidr = new ec2.CfnVPCCidrBlock(this, 'Ipv6Cidr', {
      vpcId: vpc.vpcId,
      amazonProvidedIpv6CidrBlock: true,
    });

    this.vpc.publicSubnets.forEach((subnet, idx) => {
      const vpcCidrBlock = cdk.Fn.select(0, this.vpc.vpcIpv6CidrBlocks);
      const ipv6Cidrs = cdk.Fn.cidr(
        vpcCidrBlock,
        this.vpc.publicSubnets.length,
        '64'
      );
      const cfnSubnet = subnet.node.defaultChild as ec2.CfnSubnet;
      cfnSubnet.ipv6CidrBlock = cdk.Fn.select(idx, ipv6Cidrs);
      cfnSubnet.addDependsOn(cfnIpv6Cidr);
    });

    cfnIpv6Cidr.addDependsOn(this.vpc.node.defaultChild as ec2.CfnVPC);
  }
}
