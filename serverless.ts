import { Serverless } from 'serverless/aws';

const serverlessConfiguration: Serverless = {
  service: {
    name: 'serverless-udagram-app'
  },
  frameworkVersion: '>=1.72.0',
  custom: {
    documentation:{
      models:[
        {
          name: 'GroupRequest',
          contentType: 'application/json',
          schema: '${file(models/create-group-request.json)}'
        }
      ]
    },
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true
    }
  },
  plugins: [
    'serverless-webpack',
    'serverless-aws-documentation'
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs12.x',
    apiGateway: {
      minimumCompressionSize: 1024,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      CONNECTIONS_TABLE: 'Connections-${self:provider.stage}',
      GROUPS_TABLE: 'Groups-${self:provider.stage}',
      IMAGES_TABLE: 'Images-${self:provider.stage}',
      IMAGE_ID_INDEX: 'ImageIdIndex',
      IMAGES_S3_BUCKET: 'jgonyer-serverless-udagram-images-${self:provider.stage}',
      SIGNED_URL_EXPIRATION: 300
    },
    iamRoleStatements:[
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Scan',
          'dynamodb:PutItem',
          'dynamodb:GetItem'
         ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.GROUPS_TABLE}'
      },
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Query',
          'dynamodb:PutItem'
         ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}'
      },
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Query'
         ],
        Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.IMAGES_TABLE}/index/${self:provider.environment.IMAGE_ID_INDEX}'
      },
      {
        Effect: 'Allow',
        Action:[ 
          'dynamodb:Scan',
          'dynamodb:PutItem',
          'dynamodb:DeleteItem'
         ],
        Resource: 'arn:aws:dynamodb:${opt:region, self:provider.region}:*:table/${self:provider.environment.CONNECTIONS_TABLE}'
      },
      {
        Effect: 'Allow',
        Action:[ 
          's3:PutObject',
          's3:GetObject'
         ],
        Resource: 'arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}/*'
      }
    ],
    stage: '${opt:stage, "dev"}',
    region: '${opt:region, "us-east-1"}'
  },
  functions: {
    GetGroups:{
      handler: 'src/lambda/http/getGroups.handler',
      events: [
        {
          http:{
            method: 'get',
            path: 'groups',
            cors: true            
          }
        }
      ]
    },
    CreateGroup:{
      handler: 'src/lambda/http/createGroup.handler',
      events: [
        {
          http:{
            method: 'post',
            path: 'groups',
            cors: true,
            request:{
              schema: {
                'application/json': '${file(models/create-group-request.json)}'
              }
            }
          }
        }
      ]
    },
    GetImages:{
      handler: 'src/lambda/http/getImages.handler',
      events:[
        {
          http: {
            method: 'get',
            path: 'groups/{groupId}/images',
            cors: true
          }
        }
      ]
    },
    ConnectHandler:{
      handler: 'src/lambda/websocket/connect.handler',
      events:[
        {
          websocket: {
            route: '$connect'
          }
        }
      ]
    },
    DisconnectHandler:{
      handler: 'src/lambda/websocket/disconnect.handler',
      events:[
        {
          websocket: {
            route: '$disconnect'
          }
        }
      ]
    },
    CreateImage:{
      handler: 'src/lambda/http/createImage.handler',
      events:[
        {
          http: {
            method: 'post',
            path: 'groups/{groupId}/images',
            cors: true,
          }
        }
      ]
    },
    GetImage:{
      handler: 'src/lambda/http/getImage.handler',
      events:[
        {
          http: {
            method: 'get',
            path: 'images/{imageId}',
            cors: true
          }
        }
      ]
    },
    SendUploadNotifications: {
      environment:{
        STAGE: "${self:provider.stage}",
        API_ID:{
          Ref: "WebsocketsApi"
        }
      },
      handler: 'src/lambda/s3/sendNotifications.handler'
    }
  },
  resources:{
    Resources:{
      GroupsDynamoDBTable:{
        Type: 'AWS::DynamoDB::Table',
        Properties:{
          AttributeDefinitions:[
            {
              AttributeName: 'id',
              AttributeType: 'S'
            }
          ],
          KeySchema:[
            {
              AttributeName: 'id',
              KeyType: 'HASH'
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: '${self:provider.environment.GROUPS_TABLE}'
        }
      },
      ConnectionsTable:{
        Type: 'AWS::DynamoDB::Table',
        Properties:{
          AttributeDefinitions:[
            {
              AttributeName: 'id',
              AttributeType: 'S'
            }
          ],
          KeySchema:[
            {
              AttributeName: 'id',
              KeyType: 'HASH'
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: '${self:provider.environment.CONNECTIONS_TABLE}'
        }
      },
      ImagesDynamoDBTable:{
        Type: 'AWS::DynamoDB::Table',
        Properties:{
          AttributeDefinitions:[
            {
              AttributeName: 'groupId',
              AttributeType: 'S'
            },
            {
              AttributeName: 'timestamp',
              AttributeType: 'S'
            },
            {
              AttributeName: 'imageId',
              AttributeType: 'S'
            }
          ],
          KeySchema:[
            {
              AttributeName: 'groupId',
              KeyType: 'HASH'
            },
            {
              AttributeName: 'timestamp',
              KeyType: 'RANGE'
            }
          ],
          GlobalSecondaryIndexes:[
            {
              IndexName: '${self:provider.environment.IMAGE_ID_INDEX}',
              KeySchema:[
                {
                  AttributeName: 'imageId',
                  KeyType: 'HASH'
                }
              ],
              Projection: {
                ProjectionType: 'ALL'
              }
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          TableName: '${self:provider.environment.IMAGES_TABLE}'
        }
      },
      AttachmentsBucket:{
        Type: 'AWS::S3::Bucket',
        Properties:{
          BucketName: '${self:provider.environment.IMAGES_S3_BUCKET}',
          NotificationConfiguration:{
            LambdaConfigurations:[
              {
                Event: "s3:ObjectCreated:*",
                Function: {
                  "Fn::GetAtt": ["SendUploadNotificationsLambdaFunction", "Arn"]
                }
              }
            ]
          },
          CorsConfiguration:{
            CorsRules:[
              {
                AllowedOrigins:['*'],
                AllowedHeaders: ['*'],
                AllowedMethods:[
                  'GET',
                  'PUT',
                  'POST',
                  'DELETE',
                  'HEAD'  
                ],
                MaxAge: 3000
              }
            ]
          }
        }
      },
      SendUploadNotificationsPermission:{
        Type: "AWS::Lambda::Permission",
        Properties:{
          FunctionName: {
            "Ref": "SendUploadNotificationsLambdaFunction"
          },
          Principal: "s3.amazonaws.com",
          Action: "lambda:InvokeFunction",
          SourceAccount: {
            "Ref": "AWS::AccountId"
          },
          SourceArn: "arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}"
        }
      },
      BucketPolicy:{
        Type: 'AWS::S3::BucketPolicy',
        Properties:{
          PolicyDocument:{
            Id: 'MyPolicy2',
            Version: '2012-10-17',
            Statement:[
              {
                Sid: 'PublicReadForGetBucketObjects',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: 'arn:aws:s3:::${self:provider.environment.IMAGES_S3_BUCKET}/*'
              }
            ]
          },
          Bucket: {
            Ref: 'AttachmentsBucket'
          }
        }
      },
      RequestBodyValidator:{
        Type: "AWS::ApiGateway::RequestValidator",
        Properties:{
          Name: 'request-body-validator',
          RestApiId:{
            Ref: 'ApiGatewayRestApi'
          },
          ValidateRequestBody: true,
          ValidateRequestParameters: false
        }
      }
    }
  }
}

module.exports = serverlessConfiguration;
