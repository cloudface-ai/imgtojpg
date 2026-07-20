#!/bin/bash

# Create IAM role for ECS Task Execution
set -e

echo "🔐 Creating ECS Task Execution Role..."

# Create trust policy document
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://trust-policy.json \
  --tags Key=awsApplication,Value=arn:aws:resource-groups:eu-north-1:048270140359:group/imgtojpg/06gyxng4yfycrnx3iz4dlec8d3 \
  || echo "Role might already exist"

# Attach the AWS managed policy for ECS task execution
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  || echo "Policy might already be attached"

# Clean up
rm trust-policy.json

echo "✅ ECS Task Execution Role created successfully!"
