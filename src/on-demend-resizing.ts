import { S3 } from "aws-sdk";
const sharp = require("sharp");
const s3 = new S3({ region: "ap-northeast-2", signatureVersion: "v4" });
const Bucket = "image-resizing-test-nbbangdev";
import * as http from "http";

enum SIZE {
  w200 = "w200",
  w400 = "w400",
  w600 = "w600",
}

const transforms = [
  { name: SIZE.w200, width: 200 },
  { name: SIZE.w400, width: 400 },
  { name: SIZE.w600, width: 600 },
];

const supportImageTypes: string[] = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
];

const Response = (status, statusDescription, body, contentType) => {
  const response = {
    status: "403",
    statusDescription: "Forbidden",
    headers: {
      "cache-control": [
        {
          key: "Cache-Control",
          value: "max-age=100",
        },
      ],
      "content-type": [
        {
          key: "Content-Type",
          value: "text/html",
        },
      ],
      "content-encoding": [
        {
          key: "Content-Encoding",
          value: "UTF-8",
        },
      ],
    },

    body: {},
  };

  response.status = status;
  response.statusDescription = statusDescription;
  response.body = body;
  response.headers["content-type"][0].value = contentType;
  return response;
};

export const editOriginRequestKey = async (event, context, callback) => {
  const { request } = event.Records[0].cf;
  const uri = request.uri.split("/");
  const fileName: string = uri.pop();
  const fileSize: SIZE = SIZE[uri.pop()];
  const fileType: string = fileName.split(".").pop();

  console.log(
    `uri: ${uri}, fileName:${fileName}, fileSize:${fileSize}, fileType:${fileType}`
  );

  if (!supportImageTypes.includes(fileType)) {
    console.log(`invalid Image Type::key:${request.uri}`);
    callback(
      null,
      Response(403, http.STATUS_CODES[403], "Invalid Image Type.", "text/plain")
    );
    return;
  }

  try {
    const image: Buffer = await getOriginImageAndResize(fileName, fileSize);
    console.log(`Success to convert Image`);
    callback(
      null,
      Response(
        200,
        http.STATUS_CODES[200],
        image.toString("base64"),
        `image/${fileType}`
      )
    );
  } catch (err) {
    console.log(`Failed to convert image.`);
    console.log(err.toString());

    callback(
      null,
      Response(404, http.STATUS_CODES[404], "Image not found.", "text/plain")
    );
  }

  console.log("Something wrong.");
  callback(
    null,
    Response(404, http.STATUS_CODES[404], "Image not found.", "text/plain")
  );
};

const getOriginImageAndResize = async (
  fileName: string,
  fileSize: SIZE
): Promise<Buffer> => {
  let targetImage: Buffer;
  const image = await s3
    .getObject({ Bucket, Key: `images/${fileName}` })
    .promise();

  await Promise.all(
    transforms.map(async (item) => {
      const resizedImg: Buffer = await sharp(image.Body)
        .resize({ width: item.width })
        .toBuffer();

      if (item.name === fileSize) {
        targetImage = resizedImg;
      }
      return await s3
        .putObject({
          Bucket,
          Body: resizedImg,
          Key: `resize/${item.name}/${fileName}`,
        })
        .promise();
    })
  );
  return targetImage;
};
