import { NextResponse } from 'next/server';
import OSS from 'ali-oss';

// 阿里云OSS配置（使用环境变量）
const OSS_CONFIG = {
  region: process.env.OSS_REGION || 'oss-cn-beijing',
  bucket: process.env.OSS_BUCKET || 'ssy-decoration',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  endpoint: process.env.OSS_ENDPOINT || 'oss-cn-beijing.aliyuncs.com',
};

// 测试阿里云OSS连接
export async function GET() {
  try {
    console.log('开始测试阿里云OSS连接...');
    console.log('配置:', {
      region: OSS_CONFIG.region,
      bucket: OSS_CONFIG.bucket,
      hasAccessKey: !!OSS_CONFIG.accessKeyId,
      hasSecretKey: !!OSS_CONFIG.accessKeySecret,
    });

    const client = new OSS({
      accessKeyId: OSS_CONFIG.accessKeyId,
      accessKeySecret: OSS_CONFIG.accessKeySecret,
      bucket: OSS_CONFIG.bucket,
      region: OSS_CONFIG.region,
      endpoint: OSS_CONFIG.endpoint,
      secure: true,
      authorizationV4: true,
    });

    console.log('OSS客户端初始化成功');

    // 测试上传一个简单的文本文件
    const testContent = 'Test file content - ' + new Date().toISOString();
    const buffer = Buffer.from(testContent);
    const fileName = `test/test-${Date.now()}.txt`;

    console.log('开始上传文件:', fileName);
    const result = await client.put(fileName, buffer);
    console.log('上传成功:', result);

    // 生成签名URL
    const signedUrl = client.signatureUrl(fileName, { expires: 3600 });
    console.log('签名URL生成成功');

    return NextResponse.json({
      success: true,
      message: 'OSS连接成功',
      url: signedUrl,
      result: result,
    });
  } catch (error) {
    console.error('OSS连接失败:', error);
    return NextResponse.json(
      { success: false, error: 'OSS连接失败', details: String(error) },
      { status: 500 }
    );
  }
}
