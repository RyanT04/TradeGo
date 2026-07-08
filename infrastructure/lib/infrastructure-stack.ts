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
const SUBDOMAIN_NAME = 'tradego.ryantang.dev';

// New cert for tradego.ryantang.dev (imported by ARN — already issued in ACM)
const RYANTANG_DEV_CERT_ARN =
  'arn:aws:acm:eu-west-2:276719381676:certificate/eacdfb6b-454d-4b41-8f82-eaefb159b9d4';

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

    // ── ACM certificate for trade-go.tech (CDK-managed, original) ──
    // KEEP THIS DEFINITION INTACT — removing it would trigger CloudFormation
    // to try to delete the cert, which fails while it's still attached to
    // the listener.
    const certificate = new acm.Certificate(this, 'TradeGoCert', {
      domainName: DOMAIN_NAME,
      subjectAlternativeNames: [WWW_DOMAIN],
      validation: acm.CertificateValidation.fromDns(),
    });

    // ── ACM certificate for tradego.ryantang.dev (imported, fallback) ──
    // This is the aged-domain fallback used when the uni firewall blocks
    // the newly registered .tech domain. Already issued in ACM, so we just
    // import it by ARN.
    const ryantangCertificate = acm.Certificate.fromCertificateArn(
      this,
      'RyantangDevCert',
      RYANTANG_DEV_CERT_ARN,
    );

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

        protocol: elbv2.ApplicationProtocol.HTTPS,
        listenerPort: 443,
        certificate,
        redirectHTTP: true,

        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
          containerPort: 8080,
          environment: {
              PORT: '8080',
              DB_HOST: database.dbInstanceEndpointAddress,
              DB_PORT: database.dbInstanceEndpointPort,
              DB_NAME: 'tradego',
              CLAUDE_API_KEY: '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',
              BASE_URL: 'https://trade-go.tech',
              SES_ENABLED: 'true',
              SES_FROM_EMAIL: 'noreply@trade-go.tech',
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

    // Attach the second certificate to the HTTPS listener.
    // ALB supports multiple certs per listener and selects one based on SNI.
    fargateService.listener.addCertificates('RyantangDevCertAttachment', [
      ryantangCertificate,
    ]);

    // Allow Fargate -> RDS
    database.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432));

    // Health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
    });

    // ── SES permissions ──
    fargateService.taskDefinition.taskRole?.addToPrincipalPolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    );

    // ── Outputs ──
    new cdk.CfnOutput(this, 'AppURL', {
      value: `https://${DOMAIN_NAME}`,
      description: 'Primary URL — works on most networks',
    });

    new cdk.CfnOutput(this, 'FallbackURL', {
      value: `https://${SUBDOMAIN_NAME}`,
      description: 'Fallback URL on aged domain — works behind strict firewalls',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Both domains CNAME to this',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
    });
  }
}