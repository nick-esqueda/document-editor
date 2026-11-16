# AWS setup (one time)

Copy-paste steps that create the production environment for Ajaia Doc Editor. Run them in order, in one terminal, from the repo root. Later deploys only need `scripts/deploy-backend.sh` and `scripts/deploy-frontend.sh`.

Takes about 45 minutes, most of it waiting for DNS and CloudFront.

**What gets created** (all in `us-east-2`, except the certificate, which CloudFront requires in `us-east-1`):

| Resource                      | Name                                                  | Purpose                                                                     |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Parameter Store parameters    | `/ajaia/prod/*`                                       | Passwords, session secret and settings                                      |
| S3 bucket                     | `ajaia-frontend-<account id>`                         | The React build (private, read only by CloudFront)                          |
| S3 bucket                     | `ajaia-ops-<account id>`                              | Release bundles (30 days) and nightly backups (14 days)                     |
| IAM role + instance profile   | `ajaia-ec2`                                           | Lets the instance use Session Manager, read its settings, and write backups |
| Security group                | `ajaia-web`                                           | Port 443 from CloudFront only, port 80 for certificate renewal              |
| EC2 instance + Elastic IP     | `ajaia-app` (t4g.small, Amazon Linux 2023, 20 GB gp3) | Caddy, API and Postgres in Docker                                           |
| ACM certificate (`us-east-1`) | `ajaia.nickesqueda.com`                               | HTTPS for CloudFront                                                        |
| CloudFront distribution       | `ajaia.nickesqueda.com`                               | Serves the app and forwards `/api/*` to EC2                                 |

**Cost:** about $19 a month (EC2 ≈ $12, public IPv4 ≈ $3.60, EBS ≈ $1.60, S3 + CloudFront ≈ $1).

**DNS records you add** (wherever nickesqueda.com's DNS is managed). The steps below tell you when:

| Step | Type  | Name                           | Value                                                         |
| ---- | ----- | ------------------------------ | ------------------------------------------------------------- |
| 6    | A     | `api.ajaia`                    | The Elastic IP printed in step 5                              |
| 7    | CNAME | Printed by step 7 (`_….ajaia`) | Printed by step 7 (`_….acm-validations.aws.`)                 |
| 10   | CNAME | `ajaia`                        | The CloudFront domain printed in step 9 (`d….cloudfront.net`) |

## 0. Before you start

You need the AWS CLI v2 signed in to the account (with admin rights), `jq`, `openssl`, Node 22, and this repo checked out.

```bash
aws sts get-caller-identity   # should print your account
npm ci                        # needed later to build the frontend
```

## 1. Settings for this terminal

```bash
export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2
export APP_DOMAIN=ajaia.nickesqueda.com
export ORIGIN_HOSTNAME=api.ajaia.nickesqueda.com
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export FRONTEND_BUCKET=ajaia-frontend-$ACCOUNT_ID
export OPS_BUCKET=ajaia-ops-$ACCOUNT_ID
```

If you close the terminal partway through, run this block again before continuing.

## 2. Secrets and settings in Parameter Store

Passwords are generated here and go straight into Parameter Store, so they never appear on screen or in git. Without `--overwrite`, running this twice fails instead of silently changing the database password.

```bash
put_parameter() {
  aws ssm put-parameter --name "/ajaia/prod/$1" --type "$2" --value "$3" > /dev/null && echo "saved $1"
}

put_parameter POSTGRES_USER        String       doc_editor
put_parameter POSTGRES_DB          String       doc_editor
put_parameter ORIGIN_HOSTNAME      String       "$ORIGIN_HOSTNAME"
put_parameter OPS_BUCKET           String       "$OPS_BUCKET"
put_parameter POSTGRES_PASSWORD    SecureString "$(openssl rand -hex 24)"
put_parameter SESSION_SECRET       SecureString "$(openssl rand -hex 32)"
put_parameter ORIGIN_VERIFY_SECRET SecureString "$(openssl rand -hex 32)"
put_parameter SEED_PASSWORD        SecureString "$(openssl rand -hex 8)"
```

The login password for alice, bob and carol is `SEED_PASSWORD`. To see it:

```bash
aws ssm get-parameter --name /ajaia/prod/SEED_PASSWORD --with-decryption --query Parameter.Value --output text
```

## 3. S3 buckets

```bash
for bucket in "$FRONTEND_BUCKET" "$OPS_BUCKET"; do
  aws s3api create-bucket --bucket "$bucket" \
    --create-bucket-configuration LocationConstraint=$AWS_REGION
done

aws s3api put-bucket-lifecycle-configuration --bucket "$OPS_BUCKET" \
  --lifecycle-configuration file://deploy/aws/ops-bucket-lifecycle.json
```

New buckets block all public access by default, which is what we want for both.

## 4. IAM role for the instance

```bash
aws iam create-role --role-name ajaia-ec2 \
  --assume-role-policy-document file://deploy/aws/ec2-trust-policy.json
aws iam attach-role-policy --role-name ajaia-ec2 \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

sed -e "s|REGION|$AWS_REGION|g" -e "s|ACCOUNT_ID|$ACCOUNT_ID|g" -e "s|OPS_BUCKET|$OPS_BUCKET|g" \
  deploy/aws/instance-policy.json > /tmp/ajaia-instance-policy.json
aws iam put-role-policy --role-name ajaia-ec2 --policy-name ajaia-app \
  --policy-document file:///tmp/ajaia-instance-policy.json

aws iam create-instance-profile --instance-profile-name ajaia-ec2
aws iam add-role-to-instance-profile --instance-profile-name ajaia-ec2 --role-name ajaia-ec2
```

## 5. Security group, EC2 instance and Elastic IP

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG_ID=$(aws ec2 create-security-group --group-name ajaia-web --vpc-id "$VPC_ID" \
  --description "Ajaia: 443 from CloudFront only, 80 for certificate renewal" \
  --query GroupId --output text)

CLOUDFRONT_PREFIX_LIST=$(aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --ip-permissions "IpProtocol=tcp,FromPort=443,ToPort=443,PrefixListIds=[{PrefixListId=$CLOUDFRONT_PREFIX_LIST}]"
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0

AMI_ID=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --query Parameter.Value --output text)

# If this fails with "Invalid IAM Instance Profile", wait 15 seconds (the new role is still propagating) and run it again.
INSTANCE_ID=$(aws ec2 run-instances --image-id "$AMI_ID" --instance-type t4g.small \
  --iam-instance-profile Name=ajaia-ec2 --security-group-ids "$SG_ID" \
  --metadata-options HttpTokens=required \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3,Encrypted=true}' \
  --user-data file://deploy/aws/instance-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ajaia-app}]' \
  --query 'Instances[0].InstanceId' --output text)
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

ALLOCATION_ID=$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)
aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOCATION_ID" > /dev/null
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids "$ALLOCATION_ID" --query 'Addresses[0].PublicIp' --output text)
echo "Instance $INSTANCE_ID, Elastic IP $ELASTIC_IP"
```

## 6. DNS record for the server

Add an **A** record: name `api.ajaia`, value the Elastic IP printed above. Then check it (repeat until it prints the IP):

```bash
dig +short "$ORIGIN_HOSTNAME"
```

## 7. HTTPS certificate for CloudFront (us-east-1)

```bash
CERT_ARN=$(aws acm request-certificate --region us-east-1 --domain-name "$APP_DOMAIN" \
  --validation-method DNS --query CertificateArn --output text)
sleep 10
aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output table
```

Add the **CNAME** record it prints. Most DNS panels want the name without the trailing `.nickesqueda.com.`, so enter just the `_….ajaia` part. Then wait for validation (usually 5-30 minutes; the command returns when it's done):

```bash
aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT_ARN" && echo "Certificate issued"
```

## 8. First backend deploy

Save the resource names for the deploy scripts, then deploy. This installs the app on the instance, starts Caddy (which gets its own Let's Encrypt certificate for `api.ajaia.nickesqueda.com`), runs migrations and creates alice, bob and carol.

```bash
sed -i.bak -e "s|^FRONTEND_BUCKET=.*|FRONTEND_BUCKET=$FRONTEND_BUCKET|" \
  -e "s|^OPS_BUCKET=.*|OPS_BUCKET=$OPS_BUCKET|" -e "s|^INSTANCE_ID=.*|INSTANCE_ID=$INSTANCE_ID|" \
  deploy/aws/production.env && rm deploy/aws/production.env.bak

# Session Manager needs a minute or two to see a new instance. Repeat this until it prints "Online".
aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
  --query 'InstanceInformationList[0].PingStatus' --output text

scripts/deploy-backend.sh
```

The deploy ends with `Deploy status: Success` and `Release … is live`.

## 9. CloudFront

```bash
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config Name=ajaia-frontend,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3 \
  --query OriginAccessControl.Id --output text)

aws cloudfront create-function --name ajaia-spa-routing \
  --function-config Comment="Rewrite app routes to index.html",Runtime=cloudfront-js-2.0 \
  --function-code fileb://deploy/cloudfront/spa-routing.js > /dev/null
FUNCTION_ETAG=$(aws cloudfront describe-function --name ajaia-spa-routing --query ETag --output text)
aws cloudfront publish-function --name ajaia-spa-routing --if-match "$FUNCTION_ETAG" > /dev/null
SPA_FUNCTION_ARN=$(aws cloudfront describe-function --name ajaia-spa-routing --stage LIVE \
  --query FunctionSummary.FunctionMetadata.FunctionARN --output text)

ORIGIN_VERIFY_SECRET=$(aws ssm get-parameter --name /ajaia/prod/ORIGIN_VERIFY_SECRET \
  --with-decryption --query Parameter.Value --output text)
sed -e "s|APP_DOMAIN|$APP_DOMAIN|g" -e "s|CERTIFICATE_ARN|$CERT_ARN|g" \
  -e "s|FRONTEND_BUCKET|$FRONTEND_BUCKET|g" -e "s|REGION|$AWS_REGION|g" -e "s|OAC_ID|$OAC_ID|g" \
  -e "s|ORIGIN_HOSTNAME|$ORIGIN_HOSTNAME|g" -e "s|ORIGIN_VERIFY_SECRET|$ORIGIN_VERIFY_SECRET|g" \
  -e "s|SPA_FUNCTION_ARN|$SPA_FUNCTION_ARN|g" \
  deploy/aws/cloudfront-distribution.json > /tmp/ajaia-distribution.json
DISTRIBUTION_ID=$(aws cloudfront create-distribution --distribution-config file:///tmp/ajaia-distribution.json \
  --query Distribution.Id --output text)
rm /tmp/ajaia-distribution.json   # it contains the origin secret

sed -e "s|FRONTEND_BUCKET|$FRONTEND_BUCKET|g" -e "s|ACCOUNT_ID|$ACCOUNT_ID|g" \
  -e "s|DISTRIBUTION_ID|$DISTRIBUTION_ID|g" \
  deploy/aws/frontend-bucket-policy.json > /tmp/ajaia-frontend-bucket-policy.json
aws s3api put-bucket-policy --bucket "$FRONTEND_BUCKET" --policy file:///tmp/ajaia-frontend-bucket-policy.json

sed -i.bak -e "s|^DISTRIBUTION_ID=.*|DISTRIBUTION_ID=$DISTRIBUTION_ID|" deploy/aws/production.env \
  && rm deploy/aws/production.env.bak
aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query Distribution.DomainName --output text
```

## 10. DNS record for the app, and the frontend

Add a **CNAME** record: name `ajaia`, value the `d….cloudfront.net` domain printed above. Then publish the frontend and wait for CloudFront to finish rolling out (10-15 minutes):

```bash
scripts/deploy-frontend.sh
aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID" && echo "CloudFront ready"
```

Open https://ajaia.nickesqueda.com and log in as alice with the password from step 2.

Finally, commit the filled-in `deploy/aws/production.env` (it holds only names and IDs, no secrets).

## Day-to-day

| Task                    | Command                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy API changes      | `scripts/deploy-backend.sh` (ships the committed `HEAD`)                                                                                                                          |
| Deploy frontend changes | `scripts/deploy-frontend.sh`                                                                                                                                                      |
| Shell on the server     | `aws ssm start-session --target <INSTANCE_ID>` (needs the Session Manager plugin)                                                                                                 |
| API logs                | On the server: `sudo docker compose -p ajaia logs -f api`                                                                                                                         |
| Back up now             | On the server: `sudo /opt/ajaia/current/deploy/instance/backup-database.sh`                                                                                                       |
| Check the latest backup | On the server: `sudo /opt/ajaia/current/deploy/instance/verify-latest-backup.sh`                                                                                                  |
| Change a secret         | `aws ssm put-parameter --overwrite …`, then `scripts/deploy-backend.sh` to reload it. Don't change `POSTGRES_PASSWORD` this way: Postgres keeps the password it was created with. |
