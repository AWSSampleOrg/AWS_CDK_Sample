import {
    Stack,
    StackProps,
    Environment,
    Duration,
    aws_apigateway,
    aws_lambda,
    aws_iam,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

export class CdkStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        props: StackProps & { env: Required<Environment> }
    ) {
        super(scope, id, props);

        const handler = new aws_lambda.Function(this, "HelloHandler", {
            code: aws_lambda.Code.fromAsset("build/lambda/hello"),
            functionName: "handler",
            handler: "hello.handler",
            memorySize: 128,
            role: new aws_iam.Role(this, "LambdaRole", {
                assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
                managedPolicies: [
                    {
                        managedPolicyArn:
                            "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
                    },
                    {
                        managedPolicyArn:
                            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                    },
                ],
                path: "/",
                roleName: "LambdaRole",
            }),
            runtime: aws_lambda.Runtime.NODEJS_18_X,
            timeout: Duration.seconds(3),
            tracing: aws_lambda.Tracing.ACTIVE,
            environment: {
                LOG_LEVEL: "DEBUG",
            },
        });

        new aws_apigateway.CfnAccount(this, "APIGatewayAccount", {
            cloudWatchRoleArn: new aws_iam.Role(this, "APIGatewayRole", {
                assumedBy: new aws_iam.ServicePrincipal(
                    "apigateway.amazonaws.com"
                ),
                managedPolicies: [
                    {
                        managedPolicyArn:
                            "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs",
                    },
                ],
                path: "/",
                roleName: "APIGatewayRole",
            }).roleArn,
        });

        const restApi = new aws_apigateway.CfnRestApi(
            this,
            "APIGatewayRestApi",
            {
                name: "api_gateway",
            }
        );
        const resource = new aws_apigateway.CfnResource(
            this,
            "APIGatewayResource",
            {
                restApiId: restApi.ref,
                parentId: restApi.attrRootResourceId,
                pathPart: "hello",
            }
        );
        const method = new aws_apigateway.CfnMethod(this, "APIGatewayMethod", {
            authorizationType: "NONE",
            httpMethod: "GET",
            integration: {
                type: "AWS_PROXY",
                integrationHttpMethod: "POST",
                uri: `arn:aws:apigateway:${props.env.region}:lambda:path/2015-03-31/functions/${handler.functionArn}/invocations`,
            },
            methodResponses: [{ statusCode: "200" }],
            resourceId: resource.ref,
            restApiId: restApi.ref,
        });
        new aws_apigateway.CfnDeployment(this, "APIGatewayDeployment", {
            restApiId: restApi.ref,
            stageName: "prod",
            stageDescription: {
                dataTraceEnabled: true,
                loggingLevel: "ERROR",
                metricsEnabled: true,
                tracingEnabled: true,
            },
        }).node.addDependency(method);
        new aws_lambda.CfnPermission(this, "APIGatewayLambdaInvokePermission", {
            action: "lambda:InvokeFunction",
            functionName: handler.functionName,
            principal: "apigateway.amazonaws.com",
        });
    }
}
