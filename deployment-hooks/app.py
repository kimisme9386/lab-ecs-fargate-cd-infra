import boto3
import os
import json

REGION = os.environ.get('REGION')
DEBUG = os.environ.get('DEBUG')


def handler(event, context):
    if DEBUG is not None and DEBUG != 'false':
        print("Received event: " + json.dumps(event, indent=2))

    deployment_id = event['DeploymentId']
    lifecycle_eventhook_execution_id = event['LifecycleEventHookExecutionId']

    session = boto3.Session(region_name=REGION)
    client = session.client('codedeploy')
    # status # 'Pending' | 'InProgress' | 'Succeeded' | 'Failed' | 'Skipped' | 'Unknown'
    client.put_lifecycle_event_hook_execution_status(
        deploymentId=deployment_id,
        lifecycleEventHookExecutionId=lifecycle_eventhook_execution_id,
        status='Succeeded'
    )
