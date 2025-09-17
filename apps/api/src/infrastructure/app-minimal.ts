#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';

import { ScaleMapStackMinimal } from './scalemap-stack-minimal';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Development stack
new ScaleMapStackMinimal(app, 'ScaleMapDev', {
  env,
  stage: 'dev',
});

// Staging stack
new ScaleMapStackMinimal(app, 'ScaleMapStaging', {
  env,
  stage: 'staging',
});

// Production stack
new ScaleMapStackMinimal(app, 'ScaleMapProd', {
  env,
  stage: 'production',
});