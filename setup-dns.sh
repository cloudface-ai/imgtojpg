#!/bin/bash

# Setup DNS records to point domain to load balancer
set -e

# Configuration - UPDATE THESE VALUES
DOMAIN_NAME="imgtojpg.org"
ALB_DNS="imgtojpg-alb-985371020.eu-north-1.elb.amazonaws.com"
AWS_REGION="eu-north-1"

echo "🌐 Setting up DNS records for $DOMAIN_NAME..."

# Get hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='$DOMAIN_NAME.'].Id" \
  --output text | cut -d'/' -f3)

if [ -z "$HOSTED_ZONE_ID" ]; then
  echo "❌ No hosted zone found for $DOMAIN_NAME"
  echo "   Run ./setup-domain.sh first to create the hosted zone"
  exit 1
fi

echo "✅ Found hosted zone: $HOSTED_ZONE_ID"

# Get ALB hosted zone ID (specific to region)
ALB_ZONE_ID=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns arn:aws:elasticloadbalancing:eu-north-1:048270140359:loadbalancer/app/imgtojpg-alb/c33250bda2723f4d \
  --region $AWS_REGION \
  --query 'LoadBalancers[0].CanonicalHostedZoneId' --output text)

echo "✅ ALB hosted zone ID: $ALB_ZONE_ID"

# Create DNS records
echo "📋 Creating DNS records..."

# Create A record for root domain
cat > dns-records.json << EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$DOMAIN_NAME",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "$ALB_DNS",
          "EvaluateTargetHealth": true,
          "HostedZoneId": "$ALB_ZONE_ID"
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.$DOMAIN_NAME",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "$ALB_DNS",
          "EvaluateTargetHealth": true,
          "HostedZoneId": "$ALB_ZONE_ID"
        }
      }
    }
  ]
}
EOF

# Apply DNS changes
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://dns-records.json

echo "✅ DNS records created successfully!"
echo "🌐 Your domain will be available at:"
echo "   - https://$DOMAIN_NAME"
echo "   - https://www.$DOMAIN_NAME"
echo ""
echo "⏳ DNS propagation may take 5-30 minutes"
echo "🔐 Don't forget to run ./add-https-listener.sh after certificate validation"

# Clean up
rm dns-records.json
