'use strict';

const aws = require('aws-sdk');
const codedeploy = new aws.CodeDeploy({ apiVersion: '2014-10-06' });
const util = require('util');
const exec = util.promisify(require('child_process').exec);

exports.handler = async function (event, context, callback) {
  const postmanApiKey = process.env.POSTMAN_API_KEY || '';
  const postmanCollectionUid = process.env.POSTMAN_COLLECTION_UID || '';

  //Read the DeploymentId from the event payload.
  const deploymentId = event.DeploymentId;

  //Read the LifecycleEventHookExecutionId from the event payload
  const lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;

  // Prepare the validation test results with the deploymentId and
  // the lifecycleEventHookExecutionId for CodeDeploy.
  let params = {
    deploymentId: deploymentId,
    lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
  };

  const postmanCommand = `newman run https://api.getpostman.com/collections/${postmanCollectionUid}?apikey=${postmanApiKey}`;

  const { stdout, stderr } = await exec(postmanCommand);

  if (stderr) {
    params.status = 'Failed';
    console.log(err);
  } else {
    params.status = 'Succeeded';
    console.log(`run newman test: ${stdout}`);
  }

  // Pass CodeDeploy the prepared validation test results.
  codedeploy.putLifecycleEventHookExecutionStatus(params, function (err, data) {
    if (err) {
      // Validation failed.
      callback('Validation test failed');
    } else {
      // Validation succeeded.
      callback(null, 'Validation test succeeded');
    }
  });
};
