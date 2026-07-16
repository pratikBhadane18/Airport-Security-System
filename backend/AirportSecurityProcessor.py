import json
import boto3
import os
from decimal import Decimal
from datetime import datetime

rekognition = boto3.client("rekognition")
dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")

TABLE_NAME = os.environ["TABLE_NAME"]
SNS_TOPIC_ARN = os.environ["SNS_TOPIC_ARN"]

table = dynamodb.Table(TABLE_NAME)

WEAPONS = [
    "Knife",
    "Dagger",
    "Sword",
    "Gun",
    "Pistol",
    "Revolver",
    "Rifle",
    "Shotgun",
    "Ammunition",
    "Bullet",
    "Scissors",
    "Blade",
    "Nail Clipper",
    "Cutter",
    "Multi-tool"
]


def lambda_handler(event, context):

    # Read SQS message
    sqs_body = json.loads(event["Records"][0]["body"])

    # Original S3 event inside SQS
    s3_record = sqs_body["Records"][0]

    bucket = s3_record["s3"]["bucket"]["name"]
    image = s3_record["s3"]["object"]["key"]

    print(f"Processing image: {image}")

    # Rekognition
    response = rekognition.detect_labels(
        Image={
            "S3Object": {
                "Bucket": bucket,
                "Name": image
            }
        },
        MaxLabels=10,
        MinConfidence=70
    )

    labels = []
    confidence = Decimal("0")
    detected_weapons = []

    for label in response["Labels"]:

        labels.append(label["Name"])

        current_confidence = Decimal(str(round(label["Confidence"], 2)))

        if current_confidence > confidence:
            confidence = current_confidence

        if label["Name"] in WEAPONS:
            detected_weapons.append(label["Name"])

    timestamp = datetime.utcnow().isoformat()

    # Save to DynamoDB
    table.put_item(
        Item={
            "ImageName": image,
            "Labels": labels,
            "Confidence": confidence,
            "Timestamp": timestamp,
            "WeaponDetected": len(detected_weapons) > 0,
            "WeaponLabels": detected_weapons
        }
    )

    print("Saved to DynamoDB")

    # Send Email if weapon detected
    if detected_weapons:

        message = f"""
🚨 AIRPORT SECURITY ALERT 🚨

Weapon Detected!

Bucket : {bucket}

Image : {image}

Detected Weapon(s):
{', '.join(detected_weapons)}

Confidence :
{confidence} %

Timestamp :
{timestamp}

Please verify immediately.
"""

        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject="Airport Security Alert",
            Message=message
        )

        print("SNS Email Sent")

    else:
        print("No weapon detected.")

    return {
        "statusCode": 200,
        "body": json.dumps("Image processed successfully")
    }