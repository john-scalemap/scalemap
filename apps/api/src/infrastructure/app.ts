#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';

import { ScaleMapStack } from './scalemap-stack';

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Development stack
new ScaleMapStack(app, 'ScaleMapDev', {
  env,
  stage: 'dev',
});

// Staging stack
new ScaleMapStack(app, 'ScaleMapStaging', {
  env,
  stage: 'staging',
});

// Production stack
new ScaleMapStack(app, 'ScaleMapProd', {
  env,
  stage: 'production',
});