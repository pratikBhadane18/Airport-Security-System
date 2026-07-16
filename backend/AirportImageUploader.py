import json
import boto3
import uuid
import base64
from email.parser import BytesParser
from email.policy import default

s3 = boto3.client("s3")
BUCKET = "airport-security-images-pratik"

def lambda_handler(event, context):
    try:
        content_type = event["headers"].get("content-type") or event["headers"].get("Content-Type")

        body = event["body"]

        if event.get("isBase64Encoded", False):
            body = base64.b64decode(body)
        else:
            body = body.encode()

        mime_message = (
            f"Content-Type: {content_type}\n"
            f"MIME-Version: 1.0\n\n"
        ).encode() + body

        msg = BytesParser(policy=default).parsebytes(mime_message)

        for part in msg.iter_parts():
            if part.get_content_disposition() == "form-data":
                image = part.get_payload(decode=True)
                filename = f"images/{uuid.uuid4()}.jpg"

                s3.put_object(
                    Bucket=BUCKET,
                    Key=filename,
                    Body=image,
                    ContentType="image/jpeg"
                )

                return {
                    "statusCode": 200,
                    "headers": {
                        "Access-Control-Allow-Origin": "*"
                    },
                    "body": json.dumps({
                        "message": "Upload Successful",
                        "key": filename
                    })
                }

        raise Exception("No file found")

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(str(e))
        }