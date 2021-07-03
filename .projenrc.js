const { AwsCdkTypeScriptApp } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.110.0',
  cdkVersionPinning: true,
  defaultReleaseBranch: 'main',
  name: 'lab-ecs-fargate-cd-infra',
  cdkDependencies: [
    '@aws-cdk/aws-ecr',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-ecs-patterns',
    '@aws-cdk/aws-elasticloadbalancingv2',
    '@aws-cdk/aws-logs',
    '@aws-cdk/aws-iam',
  ],
  releaseWorkflow: false,
});

project.eslint.addRules({
  'comma-dangle': [
    'error',
    {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never',
    },
  ],
});

const common_exclude = [
  'cdk.out',
  'cdk.context.json',
  'yarn-error.log',
  'dependabot.yml',
  '.idea',
];

project.gitignore.exclude(...common_exclude);

project.synth();
