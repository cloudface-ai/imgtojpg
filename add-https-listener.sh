#!/bin/bash

# Add HTTPS listener to load balancer after certificate is validated
set -e

# Configuration - UPDATE THESE VALUES
DOMAIN_NAME="imgtojpg.org"
ALB_ARN="arn:aws:elasticloadbalancing:eu-north-1:048270140359:loadbalancer/app/imgtojpg-alb/c33250bda2723f4d"
TG_ARN="arn:aws:elasticloadbalancing:eu-north-1:048270140359:targetgroup/imgtojpg-tg/9e1529aa1a827595"
AWS_REGION="eu-north-1"

echo "🔐 Adding HTTPS listener to load balancer..."

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
  --region $AWS_REGION \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
  --output text)

if [ -z "$CERT_ARN" ]; then
  echo "❌ No certificate found for $DOMAIN_NAME"
  echo "   Make sure you've run ./setup-domain.sh and validated the certificate"
  exit 1
fi

# Check certificate status
CERT_STATUS=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $AWS_REGION \
  --query 'Certificate.Status' --output text)

if [ "$CERT_STATUS" != "ISSUED" ]; then
  echo "❌ Certificate is not validated yet. Status: $CERT_STATUS"
  echo "   Please wait for DNS validation to complete"
  exit 1
fi

echo "✅ Certificate is validated: $CERT_ARN"

# Add HTTPS listener
echo "🔐 Creating HTTPS listener..."
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $AWS_REGION

# Add HTTP to HTTPS redirect
echo "🔄 Adding HTTP to HTTPS redirect..."
aws elbv2 modify-listener \
  --listener-arn $(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region $AWS_REGION --query 'Listeners[?Port==`80`].ListenerArn' --output text) \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region $AWS_REGION

echo "✅ HTTPS setup complete!"
echo "🌐 Your application is now available at: https://$DOMAIN_NAME"
