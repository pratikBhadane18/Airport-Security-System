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

    items = response["Items"]

    total = len(items)

    threats = len(
        [i for i in items if i.get("WeaponDetected", False)]
    )

    safe = total - threats

    tableLogs = []

    volume = {}

    for item in items:

        hour = item["Timestamp"][11:13] + ":00"

        volume[hour] = volume.get(hour, 0) + 1

        tableLogs.append({
            "imageName": item["ImageName"],
            "labels": item.get("Labels", []),
            "confidence": item.get("Confidence", 0),
            "weaponDetected": item.get("WeaponDetected", False),
            "timestamp": item.get("Timestamp", ""),
            "emailStatus": "Sent" if item.get("WeaponDetected", False) else "Not Required",
            "processingStatus": "Completed"
        })

    volumeTracking = []

    for key in sorted(volume):
        volumeTracking.append({
            "label": key,
            "count": volume[key]
        })

    data = {

        "totalScans": total,

        "threatDetections": threats,

        "averageLatency": 0.42,

        "rekognitionSuccessRate": 100,

        "threatRatio": {

            "safeCount": safe,

            "threatCount": threats

        },

        "volumeTracking": volumeTracking,

        "tableLogs": tableLogs

    }

    return {

        "statusCode": 200,

        "headers": {

            "Access-Control-Allow-Origin": "*"

        },

        "body": json.dumps(data, default=decimal_default)

    }