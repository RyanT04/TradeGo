import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';

const DOMAIN_NAME = 'trade-go.tech';
const WWW_DOMAIN = 'www.trade-go.tech';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Networking ──
    const vpc = new ec2.Vpc(this, 'TradeGoVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // ── RDS PostgreSQL ──
    const database = new rds.DatabaseInstance(this, 'TradeGoDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromGeneratedSecret('tradego'),
      databaseName: 'tradego',
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      multiAz: false,
      backupRetention: cdk.Duration.days(1),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── ECS Cluster ──
    const cluster = new ecs.Cluster(this, 'TradeGoCluster', {
      vpc,
    });

    // ── JWT secret ──
    const jwtSecret = new secretsmanager.Secret(this, 'TradeGoJWTSecret', {
      secretName: 'tradego/jwt',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    // ── ACM certificate (DNS-validated) ──
    // We don't have a Route 53 hosted zone (.tech registered elsewhere),
    // so we use validation: CertificateValidation.fromDns() WITHOUT a hostedZone.
    // CDK will pause on first deploy and CloudFormation will sit in CREATE_IN_PROGRESS
    // while waiting for DNS validation records to be added at .tech.
    // The records to add show up in the AWS console (Certificate Manager) — copy them
    // to the .tech DNS panel as CNAME records, and CloudFormation will resume.
    const certificate = new acm.Certificate(this, 'TradeGoCert', {
      domainName: DOMAIN_NAME,
      subjectAlternativeNames: [WWW_DOMAIN],
      validation: acm.CertificateValidation.fromDns(),
    });

    // ── Build the Go Docker image ──
    const dockerImage = new ecrAssets.DockerImageAsset(this, 'TradeGoImage', {
      directory: path.join(__dirname, '..', '..'),
      file: 'Dockerfile',
    });

    // ── Fargate service with HTTPS ──
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'TradeGoService',
      {
        cluster,
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 1,
        publicLoadBalancer: true,
        enableExecuteCommand: true,

        // HTTPS configuration
        protocol: elbv2.ApplicationProtocol.HTTPS,
        listenerPort: 443,
        certificate,

        // Auto-create an HTTP listener on 80 that redirects to HTTPS on 443
        redirectHTTP: true,

        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
          containerPort: 8080,
          environment: {
            PORT: '8080',
            DB_HOST: database.dbInstanceEndpointAddress,
            DB_PORT: database.dbInstanceEndpointPort,
            DB_NAME: 'tradego',
          },
          secrets: {
            DB_USER: ecs.Secret.fromSecretsManager(database.secret!, 'username'),
            DB_PASSWORD: ecs.Secret.fromSecretsManager(database.secret!, 'password'),
            JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: 'tradego',
            logRetention: logs.RetentionDays.ONE_WEEK,
          }),
        },
      }
    );

    // Allow Fargate -> RDS
    database.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432));

    // Health check (target the API path now)
    fargateService.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
    });

    // ── Outputs ──
    new cdk.CfnOutput(this, 'AppURL', {
      value: `https://${DOMAIN_NAME}`,
      description: 'Once DNS is pointed at the ALB, the app is reachable here',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Create a CNAME record at .tech: trade-go.tech → THIS VALUE',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
    });
  }
}