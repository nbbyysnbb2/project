import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '装修助手 | 智能装修顾问',
    template: '%s | 装修助手',
  },
  description:
    '装修助手是一款基于 AI 的智能装修顾问。通过装修知识问答、报价单检测和方案设计，为您提供专业的装修指导，实现从规划到落地的无缝衔接。',
  keywords: [
    '装修助手',
    '智能装修',
    'AI 装修',
    '装修知识',
    '报价单检测',
    '装修方案',
    '千问 LLM',
    '火山引擎知识库',
    'LangGraph',
    '装修顾问',
  ],
  authors: [{ name: 'Decoration Assistant Team' }],
  generator: 'Decoration Assistant',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: '装修助手 | 您的智能装修顾问',
    description:
      '我正在使用装修助手，通过 AI 驱动的装修知识问答、报价单检测和方案设计，让装修更省心、更专业。',
    siteName: '装修助手',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '装修助手 - 智能装修顾问',
    //   },
    // ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
