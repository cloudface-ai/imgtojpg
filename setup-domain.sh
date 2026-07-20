#!/bin/bash

# Setup custom domain for AWS ECS deployment
set -e

# Configuration - UPDATE THESE VALUES
DOMAIN_NAME="imgtojpg.org"
ALB_ARN="arn:aws:elasticloadbalancing:eu-north-1:048270140359:loadbalancer/app/imgtojpg-alb/c33250bda2723f4d"
AWS_REGION="eu-north-1"

echo "🌐 Setting up custom domain: $DOMAIN_NAME"

# Step 1: Request SSL certificate
echo "🔐 Requesting SSL certificate for $DOMAIN_NAME..."
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN_NAME \
  --subject-alternative-names "www.$DOMAIN_NAME" \
  --validation-method DNS \
  --region $AWS_REGION \
  --query 'CertificateArn' --output text)

echo "✅ Certificate requested: $CERT_ARN"

# Step 2: Get DNS validation records
echo "📋 Getting DNS validation records..."
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $AWS_REGION \
  --query 'Certificate.DomainValidationOptions[*].{Domain:DomainName,Name:ResourceRecord.Name,Value:ResourceRecord.Value,Type:ResourceRecord.Type}' \
  --output table

echo ""
echo "🚨 IMPORTANT: You need to add these DNS records to your domain registrar:"
echo "   1. Go to your domain registrar (GoDaddy, Namecheap, etc.)"
echo "   2. Add the CNAME records shown above"
echo "   3. Wait for DNS propagation (5-30 minutes)"
echo ""
echo "📋 After adding DNS records, run this command to check certificate status:"
echo "   aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION --query 'Certificate.Status'"
echo ""

# Step 3: Create Route 53 hosted zone (optional - if you want to use AWS DNS)
echo "🌐 Creating Route 53 hosted zone for $DOMAIN_NAME..."
HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
  --name $DOMAIN_NAME \
  --caller-reference "$(date +%s)" \
  --query 'HostedZone.Id' --output text) || echo "Hosted zone might already exist"

if [ "$HOSTED_ZONE_ID" != "None" ]; then
  echo "✅ Hosted zone created: $HOSTED_ZONE_ID"
  
  # Get name servers
  echo "📋 Name servers for your domain:"
  aws route53 get-hosted-zone --id $HOSTED_ZONE_ID --query 'DelegationSet.NameServers' --output table
  
  echo ""
  echo "🚨 IMPORTANT: Update your domain registrar to use these name servers"
fi

echo ""
echo "📝 Next steps:"
echo "1. Add DNS validation records to your domain registrar"
echo "2. Wait for certificate validation (5-30 minutes)"
echo "3. Run: ./add-https-listener.sh"
echo "4. Update domain name servers (if using Route 53)"
