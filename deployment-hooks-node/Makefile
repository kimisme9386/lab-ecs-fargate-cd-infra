SHELL := /bin/bash -o pipefail
STAGE := staging
REGION := ap-northeast-1

.PHONY: lambda-run
lambda-run:
	docker build -t deployment-hooks:latest .
	docker run -p 9000:8080 \
	--env AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} \
	--env AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
	--env AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN} \
	--env AWS_REGION=${CDK_DEFAULT_REGION} \
	--env STAGE=${STAGE} \
	--env REGION=${REGION} \
	--env POSTMAN_API_KEY=${POSTMAN_API_KEY} \
	--env POSTMAN_COLLECTION_UID=${POSTMAN_COLLECTION_UID} \
	deployment-hooks:latest

.PHONY: lambda-test
lambda-test:
	curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d '{"DeploymentId":"xxxxaaaaaaa","LifecycleEventHookExecutionId": "bbbbbbb"}' 
