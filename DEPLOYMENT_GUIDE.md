# ScaleMap Deployment Guide

## 🎉 Current Status
- ✅ **Backend API**: Successfully deployed to AWS
  - API Gateway: `https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod/`
  - DynamoDB: `scalemap-production`
  - S3 Bucket: `scalemap-documents-production`
  - 11 Lambda Functions: All endpoints deployed
- ✅ **Web App**: Production build successful, ready for frontend deployment
- ✅ **Environment Configuration**: Production API endpoint configured

## Next Steps to Complete Deployment

### 1. Frontend Deployment to Vercel

The web app is configured and ready for deployment. To deploy:

```bash
# Navigate to the web app directory
cd apps/web

# Install Vercel CLI (if not already installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

**Configuration Files Ready:**
- `vercel.json` - Vercel deployment configuration
- Environment variables configured for production API endpoint

### 2. Domain Configuration (Optional)

If you have a custom domain:
1. Add domain in Vercel dashboard
2. Update DNS records
3. Update `NEXTAUTH_URL` in environment variables

### 3. Environment Variables for Vercel

Set these in your Vercel dashboard or via CLI:

```bash
# Required for production
NEXT_PUBLIC_API_URL=https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod
NODE_ENV=production

# Optional (if using authentication)
NEXTAUTH_SECRET=your_production_nextauth_secret_here
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
```

## Health Checks

### Backend API Health Check
```bash
curl "https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod/health"
```

### Database Health Check
- DynamoDB table `scalemap-production` is active
- S3 bucket `scalemap-documents-production` is accessible

### Frontend Health Check (After Deployment)
- Visit your Vercel deployment URL
- Check browser console for any API connection issues
- Test system status indicator on the homepage

## Production Architecture

```
Internet
    ↓
[Vercel Frontend] ← (API calls) → [AWS API Gateway]
    ↓                                      ↓
[Next.js App]                         [Lambda Functions]
    ↓                                      ↓
[Static Assets]                      [DynamoDB + S3]
```

## Troubleshooting

### Common Issues:
1. **CORS Errors**: API Gateway CORS is configured for frontend domain
2. **Authentication Issues**: Check JWT tokens and API keys
3. **Build Errors**: React context SSR issues have been resolved

### Support:
- Check AWS CloudWatch logs for backend issues
- Use Vercel deployment logs for frontend issues
- Monitor API Gateway metrics for performance

## Cost Monitoring

**Current Production Costs (estimated monthly):**
- AWS Lambda: $0-10 (based on usage)
- DynamoDB: $5-25 (pay-per-request)
- S3: $1-5 (document storage)
- API Gateway: $1-10 (request-based)
- **Total**: ~$7-50/month depending on usage

**Vercel:**
- Free tier covers most usage
- Pro plan ($20/month) if needed for custom domains/advanced features

---

🚀 **Your ScaleMap backend is live and ready!** Complete the frontend deployment to have a fully functional production system.