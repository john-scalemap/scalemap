"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const handler = async (event) => {
    const requestId = event.requestContext?.requestId || 'unknown';
    try {
        console.log('Health check requested', { requestId });
        // Basic health check response
        const response = {
            status: 'healthy',
            message: 'ScaleMap API is healthy',
            timestamp: new Date().toISOString(),
            version: process.env.API_VERSION || '1.0.0',
            uptime: process.uptime(),
            requestId,
            environment: {
                stage: process.env.STAGE || 'dev',
                region: process.env.REGION || 'unknown',
                tableName: process.env.TABLE_NAME || 'not-configured',
                bucket: process.env.DOCUMENTS_BUCKET || 'not-configured',
            },
        };
        console.log('Health check completed', {
            status: response.status,
            requestId,
            stage: process.env.STAGE
        });
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify(response),
        };
    }
    catch (error) {
        console.error('Health check failed', { error: error.message, requestId });
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                timestamp: new Date().toISOString(),
                requestId,
            }),
        };
    }
};
exports.handler = handler;
