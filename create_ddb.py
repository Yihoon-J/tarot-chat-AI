import boto3

# DynamoDB 리소스 생성
dynamodb = boto3.resource('dynamodb')

# 테이블 생성
table = dynamodb.create_table(
        TableName='tarotchat_ddb',
        KeySchema=[
            {
                'AttributeName': 'UserId',
                'KeyType': 'HASH'  # Partition key
            },
            {
                'AttributeName': 'SessionId',
                'KeyType': 'RANGE'  # Sort key
            }
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'UserId',
                'AttributeType': 'S'
            },
            {
                'AttributeName': 'SessionId',
                'AttributeType': 'S'
            },
            {
                'AttributeName': 'LastUpdatedAt',
                'AttributeType': 'S'
            }
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'UserIdLastUpdatedIndex',
                'KeySchema': [
                    {
                        'AttributeName': 'UserId',
                        'KeyType': 'HASH'
                    },
                    {
                        'AttributeName': 'LastUpdatedAt',
                        'KeyType': 'RANGE'
                    }
                ],
                'Projection': {
                    'ProjectionType': 'ALL'
                }
            }
        ],
        BillingMode='PAY_PER_REQUEST'
    )

# 테이블이 생성될 때까지 대기
table.meta.client.get_waiter('table_exists').wait(TableName='tarotchat_ddb')

# 테이블 정보 출력
print(f"Table status: {table.table_status}")