const {
  AwsCdkTypeScriptApp,
  DependenciesUpgradeMechanism,
  Gitpod,
  DevEnvironmentDockerImage,
} = require('projen');

const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.127.0',
  cdkVersionPinning: true,
  defaultReleaseBranch: 'main',
  name: 'lab-ecs-fargate-cd-infra',
  cdkDependencies: [
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-ecr',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-ecs-patterns',
    '@aws-cdk/aws-elasticloadbalancingv2',
    '@aws-cdk/aws-logs',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-codepipeline',
    '@aws-cdk/aws-codebuild',
    '@aws-cdk/aws-codepipeline-actions',
    '@aws-cdk/aws-codedeploy',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/aws-ssm',
  ],
  devDeps: ['@types/js-yaml@^3.12.5'],
  deps: [
    'js-yaml@^3.14.1',
    '@cloudcomponents/cdk-blue-green-container-deployment@^1.40.1',
    'cdk-codepipeline-badge-notification@^0.2.11',
  ],
  releaseWorkflow: false,
  buildWorkflow: false,
  stale: false,
  depsUpgrade: DependenciesUpgradeMechanism.NONE,
  context: {
    'availability-zones:account=482631629698:region=ap-northeast-1': [
      'ap-northeast-1a',
      'ap-northeast-1c',
      'ap-northeast-1d',
    ],
  },
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

// gitpod
const gitpodPrebuild = project.addTask('gitpod:prebuild', {
  description: 'Prebuild setup for Gitpod',
});
gitpodPrebuild.exec('yarn install --frozen-lockfile --check-files');
gitpodPrebuild.exec(`npm i -g aws-cdk@${project.cdkVersion}`);

let gitpod = new Gitpod(project, {
  dockerImage: DevEnvironmentDockerImage.fromFile('.gitpod.Dockerfile'),
  prebuilds: {
    addCheck: true,
    addBadge: true,
    addLabel: true,
    branches: true,
    pullRequests: true,
    pullRequestsFromForks: true,
  },
});

gitpod.addCustomTask({
  name: 'install package and check zsh and zsh plugin',
  init: `yarn gitpod:prebuild
sudo chmod +x ./.gitpod/oh-my-zsh.sh && ./.gitpod/oh-my-zsh.sh`,
});


gitpod.addCustomTask({
  name: 'change default shell to zsh and start zsh shell',
  command: 'sudo chsh -s $(which zsh) && zsh',
});

/* spellchecker: disable */
gitpod.addVscodeExtensions(
  'dbaeumer.vscode-eslint',
  'amazonwebservices.aws-toolkit-vscode',
);


// const deployWorkflow = project.github.addWorkflow('Deploy');
// deployWorkflow.on({
//   push: {
//     branches: ['main'],
//   },
// });

// deployWorkflow.addJobs({
//   aws_cdk: {
//     runsOn: 'ubuntu-latest',
//     permissions: {
//       contents: 'read',
//     },
//     steps: [
//       {
//         name: 'checkout',
//         uses: 'actions/checkout@v2',
//       },
//       {
//         name: 'AWS assume role',
//         uses: 'aws-actions/configure-aws-credentials@v1',
//         with: {
//           'aws-access-key-id': '${{ env.ASSUME_AWS_ACCESS_KEY_ID }}',
//           'aws-secret-access-key': '${{ env.ASSUME_AWS_SECRET_KEY }}',
//           'aws-region': '${{ env.CDK_DEFAULT_REGION }}',
//           'role-to-assume': '${{ env.ASSUME_ROLE_NAME }}',
//           'role-duration-seconds': 1200,
//           'role-session-name': 'github-actions-assume-role',
//         },
//       },
//       {
//         name: 'install aws-cdk',
//         run: 'sudo npm i -g aws-cdk@' + project.cdkVersion,
//       },
//       {
//         name: 'install npm package',
//         run: 'yarn --frozen-lockfile',
//       },
//       {
//         name: 'update test snapshot',
//         run: 'yarn test:update',
//       },
//       {
//         name: 'build',
//         run: 'yarn build',
//       },
//       {
//         name: 'cdk bootstrap',
//         run: 'cdk bootstrap',
//       },
//       {
//         name: 'cdk deploy',
//         run: 'cdk deploy --require-approval never --all',
//       },
//     ],
//     env: {
//       AWS_DEFAULT_REGION: 'ap-northeast-1',
//       CDK_DEFAULT_REGION: 'ap-northeast-1',
//       ASSUME_AWS_ACCESS_KEY_ID: '${{ secrets.ASSUME_AWS_ACCESS_KEY_ID }}',
//       ASSUME_AWS_SECRET_KEY: '${{ secrets.ASSUME_AWS_SECRET_KEY }}',
//       ASSUME_CDK_DEFAULT_ACCOUNT: '${{ secrets.ASSUME_CDK_DEFAULT_ACCOUNT }}',
//       STAGE: '${{ secrets.STAGE }}',
//       ASSUME_ROLE_NAME: '${{ secrets.ASSUME_ROLE_NAME }}',
//     },
//   },
// });

project.synth();
