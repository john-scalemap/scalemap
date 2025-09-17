import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
interface ScaleMapStackProps extends cdk.StackProps {
    stage: string;
}
export declare class ScaleMapStackMinimal extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ScaleMapStackProps);
}
export {};
