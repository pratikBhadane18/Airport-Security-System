import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")

TABLE_NAME = os.environ["TABLE_NAME"]

table = dynamodb.Table(TABLE_NAME)


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def lambda_handler(event, context):

    response = table.scan()

    results = []

    for item in response["Items"]:

        image = item["ImageName"]

        results.append({
            "imageName": image,
            "imageUrl": f"https://airport-security-images-pratik.s3.ap-south-1.amazonaws.com/{image}",
            "labels": item.get("Labels", []),
            "confidence": item.get("Confidence", 0),
            "weaponDetected": item.get("WeaponDetected", False),
            "weaponLabels": item.get("WeaponLabels", []),
            "timestamp": item.get("Timestamp", ""),
            "emailStatus": "Sent" if item.get("WeaponDetected", False) else "Not Required",
            "bucketName": "airport-security-images-pratik"
        })

    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(results, default=decimal_default)
    }