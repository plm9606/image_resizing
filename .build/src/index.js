"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resize = void 0;
const aws_sdk_1 = require("aws-sdk");
const sharp = require("sharp");
const s3 = new aws_sdk_1.S3({ region: "ap-northeast-2", signatureVersion: "v4" });
const Bucket = "image-resizing-test-nbbangdev";
const transforms = [
    { name: "w200", width: 200 },
    { name: "w400", width: 400 },
    { name: "w600", width: 600 },
];
const supportImageTypes = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "svg",
    "tiff",
];
exports.resize = async (event, context, callback) => {
    const key = event.Records[0].s3.object.key;
    const fileName = key.split("/").pop();
    const fileType = fileName.split(".").pop();
    if (!supportImageTypes.includes(fileType)) {
        console.error(`invalid Image Type::key:${key}`);
    }
    try {
        const image = await s3.getObject({ Bucket, Key: key }).promise();
        await Promise.all(transforms.map(async (item) => {
            const resizedImg = await sharp(image.Body)
                .resize({ width: item.width })
                .toBuffer();
            return await s3
                .putObject({
                Bucket,
                Body: resizedImg,
                Key: `resize/${item.name}/${fileName}`,
            })
                .promise();
        }));
        callback(null, `Success: ${fileName}`);
    }
    catch (err) {
        callback(`Error resizing files: ${err}`);
    }
};
//# sourceMappingURL=index.js.map