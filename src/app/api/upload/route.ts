import { NextRequest, NextResponse } from 'next/server';
import OSS from 'ali-oss';

// 阿里云OSS配置（使用环境变量）
const OSS_CONFIG = {
  region: process.env.OSS_REGION || 'oss-cn-beijing',
  bucket: process.env.OSS_BUCKET || 'ssy-decoration',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  endpoint: process.env.OSS_ENDPOINT || 'oss-cn-beijing.aliyuncs.com',
};

// 初始化阿里云OSS客户端
const client = new OSS({
  accessKeyId: OSS_CONFIG.accessKeyId,
  accessKeySecret: OSS_CONFIG.accessKeySecret,
  bucket: OSS_CONFIG.bucket,
  region: OSS_CONFIG.region,
  endpoint: OSS_CONFIG.endpoint,
  secure: true,
  authorizationV4: true,
});

// 允许的文件类型
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  // 图片文件
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

// 最大文件大小：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '没有选择文件' }, { status: 400 });
    }

    // 验证文件数量
    if (files.length > 5) {
      return NextResponse.json({ error: '最多上传5个文件' }, { status: 400 });
    }

    const results: Array<{ name: string; url: string; size: number }> = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const file of files) {
      // 验证文件类型
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push({ name: file.name, error: '不支持的文件类型' });
        continue;
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        errors.push({ name: file.name, error: '文件大小超过10MB限制' });
        continue;
      }

      try {
        // 生成唯一文件名
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split('.').pop() || '';
        const fileName = `uploads/${timestamp}-${randomStr}.${extension}`;

        // 将文件转换为 Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 上传到 OSS
        const result = await client.put(fileName, buffer);

        // 生成签名URL
        const signedUrl = client.signatureUrl(fileName, { expires: 3600 });

        results.push({
          name: file.name,
          url: signedUrl,
          size: file.size,
        });
      } catch (uploadError) {
        errors.push({ name: file.name, error: String(uploadError) });
      }
    }

    return NextResponse.json({
      success: true,
      uploaded: results,
      failed: errors,
      total: files.length,
      successCount: results.length,
      failCount: errors.length,
    });
  } catch (error) {
    console.error('上传文件失败:', error);
    return NextResponse.json(
      { error: '上传文件失败', details: String(error) },
      { status: 500 }
    );
  }
}
