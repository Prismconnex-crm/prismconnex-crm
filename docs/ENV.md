# Required Environment Variables

To run Prism Connex locally or deploy to AWS, define these strictly in `.env`:

- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: Your AWS Cognito user pool ID.
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`: A **public** Cognito app client configured in the pool.
- `DATABASE_URL`: PostgreSQL connection string (direct connection for Prisma migrations and Edge/Local).
- `AWS_REGION`: Target Region (e.g., `us-east-1` default).
- `AWS_S3_BUCKET` (optional): Set if attachments are tested.
