'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  files?: FileInfo[];
  sources?: KnowledgeSource[]; // 知识库来源
  reasoning_content?: string; // 思考内容
  showSources?: boolean; // 是否显示知识库来源（流式输出完成后才显示）
}

interface FileInfo {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface KnowledgeSource {
  index: string;
  title: string;
  content: string;
  link: string;
  datasetName?: string; // 知识库名称
  score?: number; // 相关性分数
}

// 引用标注组件
function CitationMarker({ index, sources }: { index: number; sources: KnowledgeSource[] }) {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  const source = sources.find(s => parseInt(s.index, 10) === index);

  const handleMouseEnter = () => {
    if (markerRef.current && source) {
      const rect = markerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.left + rect.width / 2
      });
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPosition(null);
  };

  return (
    <span
      ref={markerRef}
      className="citation-marker text-primary font-bold cursor-help border-b border-dotted border-primary px-0.5 hover:bg-primary/10 transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      [{index}]
      {isHovered && source && position && (
        <div
          className="fixed p-4 bg-popover text-popover-foreground rounded-2xl shadow-2xl shadow-black/10 border border-border z-50 pointer-events-none backdrop-blur-xl"
          style={{
            bottom: `calc(100vh - ${position.top}px + 10px)`,
            left: position.left,
            transform: 'translateX(-50%)',
            maxWidth: '340px'
          }}
        >
          <div className="text-xs font-mono bg-primary/20 text-primary-foreground px-2 py-1 rounded-lg inline-block mb-2.5 shadow-sm">
            [{source.index}]
          </div>
          <div className="text-sm font-semibold mb-2 text-foreground">{source.title}</div>
          <div className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">{source.content}</div>
        </div>
      )}
    </span>
  );
}

// 引用标注渲染器
function CitationRenderer({ htmlContent, sources }: { htmlContent: string; sources: KnowledgeSource[] }) {
  // 使用正则表达式替换 HTML 中的引用标注为占位符
  const parts = htmlContent.split(/(\[\d+\])/g);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      {parts.map((part, idx) => {
        const match = part.match(/\[(\d+)\]/);
        if (match) {
          const index = parseInt(match[1], 10);
          return <CitationMarker key={idx} index={index} sources={sources} />;
        }
        return <span key={idx} dangerouslySetInnerHTML={{ __html: part }} />;
      })}
    </div>
  );
}

// HTML 转义函数
function escapeHtml(text: string): string {
  const htmlEscapes: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

// 简单的 Markdown 解析器
function parseMarkdown(text: string): string {
  let lines = text.split('\n');
  let result = [];

  let inOrderedList = false;
  let inUnorderedList = false;
  let inCodeBlock = false;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let codeLanguage = '';
  let codeContent = [];

  // 辅助函数：检测是否是表格行
  const isTableRow = (line: string): boolean => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
  };

  // 辅助函数：检测是否是表格分隔行
  const isTableSeparator = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
    const content = trimmed.substring(1, trimmed.length - 1);
    const cells = content.split('|').map(c => c.trim());
    return cells.every(cell => /^-+:?$|^:-+:?$|^:-+$/.test(cell));
  };

  // 辅助函数：结束表格
  const endTable = () => {
    if (inTable) {
      let tableHtml = '<div class="my-4 overflow-x-auto rounded-xl border border-border/50 shadow-sm">';
      tableHtml += '<table class="w-full text-sm border-collapse">';
      
      // 渲染表头
      tableHtml += '<thead><tr class="bg-muted/50 border-b border-border/50">';
      tableHeaders.forEach((header, idx) => {
        const cellClass = idx === 0 ? 'text-left px-4 py-3 font-semibold text-foreground/90' : 'text-left px-4 py-3 font-semibold text-foreground/90';
        tableHtml += `<th class="${cellClass}">${processInline(header)}</th>`;
      });
      tableHtml += '</tr></thead>';
      
      // 渲染数据行
      tableHtml += '<tbody>';
      tableRows.forEach((row, rowIdx) => {
        tableHtml += `<tr class="${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'} border-b border-border/30 hover:bg-muted/40 transition-colors">`;
        row.forEach((cell, cellIdx) => {
          tableHtml += `<td class="px-4 py-3 text-foreground/80">${processInline(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody>';
      
      tableHtml += '</table></div>';
      result.push(tableHtml);
      
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  // 辅助函数：处理Markdown内联语法
  const processInline = (content: string): string => {
    // 先处理链接，避免被其他替换影响
    let processed = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');
    // 处理代码行
    processed = processed.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-muted/70 rounded text-sm font-mono text-foreground/90">$1</code>');
    // 处理删除线
    processed = processed.replace(/~~(.*?)~~/g, '<del class="line-through text-muted-foreground">$1</del>');
    // 处理加粗
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // 处理斜体
    processed = processed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    return processed;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 处理代码块开始
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // 代码块开始
        if (inOrderedList || inUnorderedList) {
          result.push(inOrderedList ? '</ol>' : '</ul>');
          inOrderedList = false;
          inUnorderedList = false;
        }
        inCodeBlock = true;
        codeLanguage = line.substring(3).trim();
        codeContent = [];
        continue;
      } else {
        // 代码块结束
        inCodeBlock = false;
        const codeHtml = codeContent.join('\n');
        result.push(
          `<pre class="my-4 p-4 bg-muted/80 rounded-lg overflow-x-auto"><code class="text-sm font-mono">${escapeHtml(codeHtml)}</code></pre>`
        );
        codeContent = [];
        continue;
      }
    }

    // 如果在代码块中，收集代码内容
    if (inCodeBlock) {
      codeContent.push(lines[i]); // 保留原始缩进
      continue;
    }

    // 处理表格
    if (isTableRow(line)) {
      // 如果之前在列表中，结束列表
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }

      // 如果不在表格中，检查是否是表格的开始
      if (!inTable) {
        // 下一行是否是分隔行？
        if (i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
          inTable = true;
          // 解析表头
          const content = line.substring(1, line.length - 1);
          tableHeaders = content.split('|').map(c => c.trim());
          // 跳过分隔行（在下次循环处理）
          continue;
        }
      } else {
        // 如果已经在表格中，检查是否是分隔行
        if (isTableSeparator(line)) {
          continue; // 跳过分隔行
        } else {
          // 解析数据行
          const content = line.substring(1, line.length - 1);
          const cells = content.split('|').map(c => c.trim());
          tableRows.push(cells);
          continue;
        }
      }
    }

    // 如果在表格中，但当前行不是表格行，结束表格
    if (inTable && !isTableRow(line)) {
      endTable();
    }

    // 处理分隔符 ---
    if (line === '---' || line === '***') {
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      result.push('<hr class="my-4 border-border/50" />');
      continue;
    }

    // 处理标题 - 按级别从高到低检查
    if (line.startsWith('###### ')) {
      // 六级标题
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const title = processInline(line.substring(7));
      result.push(`<h6 class="text-xs font-bold mt-2 mb-1 text-foreground/80">${title}</h6>`);
    } else if (line.startsWith('##### ')) {
      // 五级标题
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const title = processInline(line.substring(6));
      result.push(`<h5 class="text-xs font-bold mt-2 mb-1 text-foreground/85">${title}</h5>`);
    } else if (line.startsWith('#### ')) {
      // 四级标题
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const title = processInline(line.substring(5));
      result.push(`<h4 class="text-sm font-bold mt-3 mb-2 text-foreground/90">${title}</h4>`);
    } else if (line.startsWith('### ')) {
      // 三级标题
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const title = processInline(line.substring(4));
      result.push(`<h3 class="text-base font-bold mt-4 mb-2">${title}</h3>`);
    } else if (line.startsWith('## ')) {
      // 二级标题
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const title = processInline(line.substring(3));
      result.push(`<h2 class="text-lg font-bold mt-5 mb-3">${title}</h2>`);
    } else if (line.startsWith('# ')) {
      // 一级标题
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const title = processInline(line.substring(2));
      result.push(`<h1 class="text-xl font-bold mt-6 mb-4">${title}</h1>`);
    }
    // 处理引用块
    else if (line.startsWith('> ')) {
      if (inOrderedList || inUnorderedList) {
        result.push(inOrderedList ? '</ol>' : '</ul>');
        inOrderedList = false;
        inUnorderedList = false;
      }
      const content = processInline(line.substring(2));
      result.push(`<blockquote class="pl-4 py-2 border-l-4 border-primary/50 my-3 bg-muted/30 rounded-r">${content}</blockquote>`);
    }
    // 处理任务列表
    else if (/^-\s+\[[ xX]\]\s+/.test(line)) {
      if (!inUnorderedList) {
        if (inOrderedList) {
          result.push('</ol>');
          inOrderedList = false;
        }
        result.push('<ul class="list-none my-3 ml-4">');
        inUnorderedList = true;
      }
      const isChecked = /^-\s+\[[xX]\]\s+/.test(line);
      const content = processInline(line.replace(/^-\s+\[[ xX]\]\s+/, ''));
      result.push(
        `<li class="mb-1 leading-relaxed tracking-wide flex items-start gap-2">
          <input type="checkbox" ${isChecked ? 'checked' : ''} class="mt-1.5 rounded border-border" disabled />
          <span>${content}</span>
        </li>`
      );
    }
    // 处理有序列表
    else if (/^\d+\.\s+/.test(line)) {
      if (!inOrderedList) {
        if (inUnorderedList) {
          result.push('</ul>');
          inUnorderedList = false;
        }
        result.push('<ol class="list-decimal list-inside my-3 ml-4">');
        inOrderedList = true;
      }
      const content = processInline(line.replace(/^\d+\.\s+/, ''));
      result.push(`<li class="mb-1 leading-relaxed tracking-wide">${content}</li>`);
    }
    // 处理无序列表
    else if (/^-\s+/.test(line)) {
      if (!inUnorderedList) {
        if (inOrderedList) {
          result.push('</ol>');
          inOrderedList = false;
        }
        result.push('<ul class="list-disc list-inside my-3 ml-4">');
        inUnorderedList = true;
      }
      const content = processInline(line.replace(/^-\s+/, ''));
      result.push(`<li class="mb-1 leading-relaxed tracking-wide">${content}</li>`);
    }
    // 处理空行
    else if (line === '') {
      if (inOrderedList) {
        result.push('</ol>');
        inOrderedList = false;
      } else if (inUnorderedList) {
        result.push('</ul>');
        inUnorderedList = false;
      } else {
        result.push('<br class="my-2">');
      }
    }
    // 处理普通段落
    else {
      if (inOrderedList) {
        result.push('</ol>');
        inOrderedList = false;
      } else if (inUnorderedList) {
        result.push('</ul>');
        inUnorderedList = false;
      }
      const content = processInline(line);
      result.push(`<p class="mb-2 leading-relaxed tracking-wide">${content}</p>`);
    }
  }

  // 关闭可能未关闭的标签
  endTable(); // 关闭可能未关闭的表格
  if (inOrderedList) result.push('</ol>');
  if (inUnorderedList) result.push('</ul>');

  return result.join('');
}

// 简化的 Markdown 渲染器
function MarkdownRenderer({ content, sources }: { content: string; sources: KnowledgeSource[] }) {
  const htmlContent = parseMarkdown(content);
  return <CitationRenderer htmlContent={htmlContent} sources={sources} />;
}

// 思考内容展示组件
function ReasoningContentDisplay({ reasoning }: { reasoning: string }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-[870px] max-w-full mx-auto mb-4">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 overflow-hidden">
        {/* 标题栏 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-primary/10 hover:bg-primary/15 transition-colors duration-200"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-foreground/90">思考过程</span>
          </div>
          <svg
            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 思考内容 */}
        {isExpanded && (
          <div className="px-4 py-3 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {reasoning}
          </div>
        )}
      </div>
    </div>
  );
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);
  const [showAgentThinking, setShowAgentThinking] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true); // 是否应该自动滚动
  const [showScrollToBottom, setShowScrollToBottom] = useState(false); // 是否显示"一键到底部"按钮
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null); // 刚复制的消息ID
  const [newConversationToast, setNewConversationToast] = useState<string | null>(null); // 新建对话提示

  // 消息列表容器ref，用于自动滚动
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 思考提示的定时器
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化用户ID（从localStorage读取或生成新ID）
  useEffect(() => {
    let savedUserId = localStorage.getItem('decoration_user_id');
    if (!savedUserId) {
      // 生成新的用户ID
      savedUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('decoration_user_id', savedUserId);
      console.log('[初始化] 生成新的用户ID:', savedUserId);
    } else {
      console.log('[初始化] 使用已保存的用户ID:', savedUserId);
    }
    setUserId(savedUserId);
  }, []);

  // 加载历史对话
  useEffect(() => {
    const saved = localStorage.getItem('chat-conversations');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConversations(parsed);
      if (parsed.length > 0) {
        setCurrentConversationId(parsed[0].id);
      }
    }
  }, []);

  // 切换对话时自动滚动到底部
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [currentConversationId]);

  // 消息更新时自动滚动到底部（包括流式输出）
  useEffect(() => {
    const currentConv = conversations.find(c => c.id === currentConversationId);
    if (currentConv && messagesContainerRef.current && shouldAutoScroll) {
      // 检查最后一条消息的内容是否有变化
      const lastMessage = currentConv.messages[currentConv.messages.length - 1];
      if (lastMessage && (lastMessage.role === 'assistant' || lastMessage.role === 'user')) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, [conversations, currentConversationId, shouldAutoScroll]); // 监听整个conversations对象的变化

  // 监听滚动事件，检测用户是否手动向上滚动
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // 如果距离底部超过100px，说明用户向上滚动了
      if (distanceFromBottom > 100) {
        setShouldAutoScroll(false); // 停止自动滚动
        setShowScrollToBottom(true); // 显示"一键到底部"按钮
      } else {
        setShouldAutoScroll(true); // 恢复自动滚动
        setShowScrollToBottom(false); // 隐藏"一键到底部"按钮
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [currentConversationId]);

  // 智能体思考状态提示
  useEffect(() => {
    if (isLoading) {
      // 延迟1秒后显示思考状态（避免快速响应时不显示）
      thinkingTimeoutRef.current = setTimeout(() => {
        setShowAgentThinking(true);
      }, 1000);
    } else {
      // 立即隐藏思考状态
      setShowAgentThinking(false);
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = null;
      }
    }

    return () => {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, [isLoading]);

  // 保存对话到本地存储
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('chat-conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // 创建新对话（只能有一个空对话）
  const createNewConversation = () => {
    // 检查是否已存在空对话（无论是什么情况下创建的）
    const existingEmptyConversation = conversations.find(c => c.messages.length === 0);
    if (existingEmptyConversation) {
      console.log('[新建对话] 已存在空对话，不创建新的');
      setCurrentConversationId(existingEmptyConversation.id);
      setNewConversationToast('已是最新对话');
      // 2秒后隐藏提示
      setTimeout(() => setNewConversationToast(null), 2000);
      return;
    }

    // 创建新对话
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations([newConversation, ...conversations]);
    setCurrentConversationId(newConversation.id);
    console.log('[新建对话] 创建新对话:', newConversation.id);
  };

  // 删除对话
  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    if (currentConversationId === id) {
      setCurrentConversationId(updated.length > 0 ? updated[0].id : null);
    }
    localStorage.setItem('chat-conversations', JSON.stringify(updated));
  };

  // 获取当前对话
  const getCurrentConversation = (): Conversation | null => {
    const conv = conversations.find(c => c.id === currentConversationId);
    return conv || null;
  };

  // 复制消息内容到剪贴板
  const copyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      // 2秒后隐藏复制成功的提示
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if ((!inputMessage.trim() && selectedFiles.length === 0) || isLoading || isUploading) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // 在外部定义变量以便在catch块中使用
    let uploadedFiles: any[] = [];
    let currentConversation: Conversation | null = null;
    let updatedMessages: Message[] = [];
    let updatedConversation: Conversation | null = null;
    let localConversations = [...conversations]; // 使用本地变量跟踪对话列表

    try {
      // 获取用户ID（必须在sendMessage开始时就获取）
      const userId = localStorage.getItem('decoration_user_id');
      console.log('[前端] sendMessage开始，userId:', userId);

      // 上传文件
      uploadedFiles = await uploadFiles();

      // 如果没有当前对话，创建一个（或者切换到现有空对话）
      currentConversation = localConversations.find(c => c.id === currentConversationId) || null;
      if (!currentConversation) {
        console.log('[前端] 需要创建新对话，userId:', userId);
        // 调用 createNewConversation，它会自动处理是否存在空对话的情况
        createNewConversation();
        // 重新获取当前对话
        currentConversation = localConversations.find(c => c.id === currentConversationId) || null;
        if (!currentConversation) {
          // 如果仍然没有对话，直接创建一个（用于 sendMessage）
          const newConversation: Conversation = {
            id: Date.now().toString(),
            title: '新对话',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          localConversations = [newConversation, ...localConversations];
          currentConversation = newConversation;
          setCurrentConversationId(newConversation.id);
        }
      }

      if (!currentConversation) return;

      console.log('[前端] 准备发送消息:', {
        conversationId: currentConversation.id,
        userId,
        message: messageContent
      });

      // 添加用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: messageContent,
        timestamp: Date.now(),
        files: uploadedFiles,
      };

      updatedMessages = [...currentConversation.messages, userMessage];

      // 更新对话标题（如果是第一条消息）
      updatedConversation = {
        ...currentConversation,
        messages: updatedMessages,
        title: currentConversation.messages.length === 0
          ? (messageContent || uploadedFiles[0]?.name || '新对话').slice(0, 20) + ((messageContent || uploadedFiles[0]?.name || '').length > 20 ? '...' : '')
          : currentConversation.title,
        updatedAt: Date.now(),
      };

      // 更新本地对话列表
      localConversations = localConversations.map(c => c.id === updatedConversation?.id ? updatedConversation! : c);
      setConversations(localConversations);

      console.log('[前端] 发送请求给后端:', {
        userId,
        conversationId: currentConversation.id,
        message: messageContent
      });

      // 调用后端API（添加超时控制）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 900000); // 15分钟超时（扣子工作流可能需要较长时间）

      let response: Response;
      try {
        response = await fetch('/api/decoration-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageContent,
            files: uploadedFiles,
            userId: userId,
            conversationId: currentConversation.id, // 使用对话ID作为conversationId
          }),
          signal: controller.signal,
        });
      } catch (error: any) {
        clearTimeout(timeoutId);

        let errorMessage = '发送消息失败';
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请稍后重试';
        } else if (error instanceof TypeError) {
          errorMessage = '网络连接错误，请检查网络';
        }

        console.error('发送消息失败:', error);
        throw new Error(errorMessage);
      }
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        // 尝试读取错误响应体
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = errorData.error || '';
        } catch (e) {
          // 如果无法解析JSON，忽略
        }
        
        const errorMsg = `API请求失败 (${response.status}${errorDetail ? ': ' + errorDetail : ''})`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      console.log('[前端] 开始读取SSE流，当前对话:', {
        id: updatedConversation?.id
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        showSources: false, // 初始不显示知识库来源
      };

      // 流式读取响应
      const decoder = new TextDecoder();
      let fullContent = '';
      let fullReasoningContent = '';
      let knowledgeSources: KnowledgeSource[] = [];
      let shouldBreak = false; // 用于跳出 while 循环的标志
      let buffer = ''; // 用于累积不完整的数据

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                shouldBreak = true;
                break;
              }

              if (!data) continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.content) {
                  // 直接使用后端发送的完整累积内容
                  fullContent = parsed.content;
                  assistantMessage.content = fullContent;

                  // 实时更新UI
                  if (updatedConversation) {
                    const messagesWithAssistant = [...updatedMessages, { ...assistantMessage }];
                    localConversations = localConversations.map(c =>
                      c.id === updatedConversation!.id
                        ? { ...updatedConversation!, messages: messagesWithAssistant }
                        : c
                    );
                    setConversations(localConversations);
                  }
                }
                // 处理思考内容
                if (parsed.reasoning_content) {
                  // 直接使用后端发送的完整累积内容
                  fullReasoningContent = parsed.reasoning_content;
                  assistantMessage.reasoning_content = fullReasoningContent;

                  // 实时更新UI
                  if (updatedConversation) {
                    const messagesWithReasoning = [...updatedMessages, { ...assistantMessage }];
                    localConversations = localConversations.map(c =>
                      c.id === updatedConversation!.id
                        ? { ...updatedConversation!, messages: messagesWithReasoning }
                        : c
                    );
                    setConversations(localConversations);
                  }
                }
                if (parsed.sources && Array.isArray(parsed.sources)) {
                  knowledgeSources = parsed.sources;
                  assistantMessage.sources = knowledgeSources;
                  assistantMessage.showSources = false; // 收到知识库来源但暂时不显示
                  console.log('[前端] 收到知识库来源:', knowledgeSources.length, '个');

                  // 更新UI但不显示来源
                  if (updatedConversation) {
                    const messagesWithSources = [...updatedMessages, { ...assistantMessage }];
                    localConversations = localConversations.map(c =>
                      c.id === updatedConversation!.id
                        ? { ...updatedConversation!, messages: messagesWithSources }
                        : c
                    );
                    setConversations(localConversations);
                  }
                }
              } catch (e) {
                // JSON解析错误，跳过该数据块
                console.warn('解析响应失败，跳过该数据块:', e instanceof SyntaxError ? 'JSON格式错误' : e);
                console.log('数据长度:', data.length, '前50字符:', data.substring(0, 50));
                continue;
              }
            }
          }

          // 如果收到 [DONE] 标记，跳出 while 循环
          if (shouldBreak) {
            console.log('[前端] 收到 [DONE] 标记，结束流读取');
            break;
          }
        } catch (readError: any) {
          // 读取流时发生错误（如用户刷新页面）
          if (readError.name === 'AbortError' || readError.message?.includes('Failed to fetch')) {
            console.log('请求被取消或连接中断');
            break;
          } else {
            console.error('读取响应流时发生错误:', readError);
            throw readError;
          }
        }
      }

      // 确保最终状态更新，显示知识库来源
      if (updatedConversation) {
        // 使用本地对话列表进行最终更新
        localConversations = localConversations.map(c => {
          if (c.id === updatedConversation!.id) {
            // 如果有新的conversation_id，使用它
            const finalConversation = {
              ...c,
              messages: [
                ...updatedMessages,
                {
                  ...assistantMessage,
                  content: fullContent,
                  reasoning_content: fullReasoningContent,
                  sources: knowledgeSources,
                  showSources: true // 流式输出完成后，显示知识库来源
                }
              ]
            };
            return finalConversation;
          }
          return c;
        });

        console.log('[前端] SSE流结束，最终更新对话');
        setConversations(localConversations);
      }

    } catch (error: any) {
      console.error('发送消息失败:', error);
      
      // 生成更详细的错误消息
      let errorContent = '抱歉，消息发送失败，请稍后重试。';
      
      if (error.message) {
        if (error.message.includes('超时')) {
          errorContent = '抱歉，请求超时。智能体正在执行任务中，请稍后重试。';
        } else if (error.message.includes('网络')) {
          errorContent = '抱歉，网络连接失败。请检查您的网络连接后重试。';
        } else if (error.message.includes('API请求失败')) {
          errorContent = '抱歉，服务暂时不可用，请稍后重试。';
        }
      }
      
      // 添加错误消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: Date.now(),
      };

      if (updatedConversation && updatedMessages.length > 0) {
        localConversations = localConversations.map(c =>
          c.id === updatedConversation!.id
            ? { ...updatedConversation!, messages: [...updatedMessages, errorMessage] }
            : c
        );
        setConversations(localConversations);
      } else if (currentConversation) {
        setConversations(conversations.map(c =>
          c.id === currentConversation!.id
            ? { ...currentConversation!, messages: [...currentConversation!.messages, errorMessage] }
            : c
        ));
      }
    } finally {
      setIsLoading(false);
      setSelectedFiles([]);
    }
  };

  // 按Enter发送，Shift+Enter换行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 文件选择处理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
    ];

    const validFiles = files.filter(file => allowedTypes.includes(file.type));

    if (validFiles.length !== files.length) {
      alert('只支持 PDF、Word、Excel 文件和图片文件（JPG、PNG、GIF、WebP）');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  // 移除文件
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 判断文件是否为图片
  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  // 生成图片预览URL
  const getImagePreviewUrl = (file: File): string => {
    return URL.createObjectURL(file);
  };

  // 上传文件
  const uploadFiles = async (): Promise<FileInfo[]> => {
    if (selectedFiles.length === 0) return [];

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      setIsUploading(true);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('文件上传失败');
      }

      const result = await response.json();
      console.log('[前端] 文件上传结果:', result);
      const files = result.files || [];
      console.log('[前端] 上传的文件详情:', files.map((f: FileInfo) => ({ name: f.name, url: f.url.substring(0, 100) })));
      return files;
    } catch (error) {
      console.error('上传文件失败:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const currentConversation = getCurrentConversation();

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* 侧边栏 */}
      <div
        className={`${
          isSidebarOpen ? 'w-80 opacity-100' : 'w-0 opacity-0'
        } transition-all duration-300 ease-in-out border-r border-border bg-sidebar flex flex-col ${
          isSidebarOpen ? '' : 'pointer-events-none'
        } overflow-hidden`}
        style={{ minWidth: isSidebarOpen ? '20rem' : '0' }}
      >
        {/* 侧边栏头部 */}
        <div className="p-6 border-b border-border/50 backdrop-blur-xl" style={{ display: isSidebarOpen ? 'block' : 'none' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 backdrop-blur-md">
              <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/70 bg-clip-text text-transparent">
                装修助手
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">您的智能装修顾问</p>
            </div>
          </div>
          <button
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-sidebar-primary via-sidebar-primary to-sidebar-primary/90 text-sidebar-primary-foreground rounded-2xl hover:from-sidebar-primary/95 hover:via-sidebar-primary/95 hover:to-sidebar-primary/85 shadow-lg shadow-sidebar-primary/20 hover:shadow-xl hover:shadow-sidebar-primary/30 transition-all duration-300 hover:scale-[1.02] backdrop-blur-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-semibold">新建对话</span>
          </button>
        </div>

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ display: isSidebarOpen ? 'block' : 'none' }}>
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => setCurrentConversationId(conversation.id)}
              className={`group relative flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 border backdrop-blur-sm ${
                currentConversationId === conversation.id
                  ? 'bg-gradient-to-r from-sidebar-primary/15 via-sidebar-primary/10 to-sidebar-primary/15 border-sidebar-primary/30 text-sidebar-foreground shadow-lg shadow-sidebar-primary/10'
                  : 'hover:bg-sidebar-accent/50 hover:border-border/20 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  currentConversationId === conversation.id
                    ? 'bg-sidebar-primary/25'
                    : 'bg-muted/50 group-hover:bg-muted'
                }`}>
                  <svg className={`w-4 h-4 transition-colors ${
                    currentConversationId === conversation.id
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="flex-1 truncate text-sm font-medium">
                  {conversation.title || '新对话'}
                </div>
              </div>
              <button
                onClick={(e) => deleteConversation(conversation.id, e)}
                className="opacity-0 group-hover:opacity-100 p-2 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-200 hover:scale-110"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        <div className="h-16 border-b border-border/30 flex items-center px-6 bg-background/80 backdrop-blur-2xl sticky top-0 z-10 shadow-sm shadow-black/5">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 hover:bg-accent/80 rounded-xl transition-all duration-300 hover:shadow-md group"
          >
            <svg className="w-5 h-5 text-foreground/70 group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-5 flex items-center gap-3">
            <div className="w-1.5 h-7 bg-gradient-to-b from-primary to-primary/50 rounded-full shadow-sm shadow-primary/30"></div>
            <h1 className="text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {currentConversation?.title || '新对话'}
            </h1>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto relative scroll-smooth" ref={messagesContainerRef}>
          {!currentConversation || currentConversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-20">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/20 flex items-center justify-center shadow-xl shadow-primary/10">
                  <svg className="w-12 h-12 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent mb-3">
                有什么我能帮你的吗？
              </h2>
              <p className="text-muted-foreground text-center max-w-md">
                输入您的问题，智能装修助手将为您提供专业的解答
              </p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto w-full px-20 py-8">
              {currentConversation?.messages.map((message) => (
                <div
                  key={message.id}
                  className="mb-8 relative group/message"
                >
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="w-fit max-w-2xl rounded-3xl rounded-br-sm px-6 py-4 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white shadow-2xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-[1.01] backdrop-blur-md border border-white/20">
                      {/* 文件列表 */}
                      {message.files && message.files.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {message.files.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2.5 px-3 py-2.5 bg-white/25 rounded-xl backdrop-blur-sm border border-white/10"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline truncate flex-1"
                              >
                                {file.name}
                              </a>
                              <span className="text-xs font-medium px-2 py-1 bg-white/30 rounded-lg">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 消息内容 */}
                      {message.content && (
                        <div className="leading-relaxed">
                          <MarkdownRenderer content={message.content} sources={message.sources || []} />
                        </div>
                      )}
                    </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-4xl mx-auto pt-3 pl-4">
                      {/* 思考内容 */}
                      {message.reasoning_content && (
                        <ReasoningContentDisplay reasoning={message.reasoning_content} />
                      )}

                      {/* 文件列表 */}
                      {message.files && message.files.length > 0 && (
                            <div className="mb-4 space-y-2">
                              {message.files.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 rounded-xl border border-border/30 hover:border-primary/30 transition-all duration-300 backdrop-blur-sm"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/15 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium hover:text-primary hover:underline truncate flex-1"
                                  >
                                    {file.name}
                                  </a>
                                  <span className="text-xs text-muted-foreground font-medium px-2.5 py-1 bg-muted/80 rounded-lg border border-border/30 backdrop-blur-sm">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 消息内容 */}
                          {message.content && (
                            <div className="leading-relaxed text-foreground/90">
                              <MarkdownRenderer content={message.content} sources={message.sources || []} />
                            </div>
                          )}

                          {/* 复制按钮 */}
                          {message.content && (
                            <div className="mt-4 flex items-center gap-2">
                              <button
                                onClick={() => copyMessage(message.content, message.id)}
                                className="group/btn flex items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-muted/80 hover:to-muted/60 rounded-xl transition-all duration-300 hover:shadow-md border border-transparent hover:border-border/50"
                                title="复制内容"
                              >
                                <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                复制
                              </button>

                              {/* 复制成功提示 */}
                              {copiedMessageId === message.id && (
                                <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 animate-in fade-in slide-in-from-left-2 duration-300">
                                  ✓ 已复制到剪贴板
                                </span>
                              )}
                            </div>
                          )}

                          {/* 知识库来源 - 只在流式输出完成后显示 */}
                          {message.showSources && message.sources && message.sources.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-border/30">
                              <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2.5 font-semibold">
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 backdrop-blur-sm">
                                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                </div>
                                知识库来源
                              </div>
                              <div className="space-y-3.5">
                                {message.sources.map((source, idx) => (
                                  <div
                                    key={idx}
                                    onClick={() => setSelectedSource(source)}
                                    className="group block p-5 bg-gradient-to-br from-sidebar-accent/40 via-sidebar-accent/25 to-sidebar-accent/40 rounded-2xl cursor-pointer hover:from-sidebar-accent/60 hover:via-sidebar-accent/45 hover:to-sidebar-accent/60 transition-all duration-300 border border-border/40 hover:border-sidebar-primary/40 hover:shadow-xl hover:shadow-sidebar-primary/15 backdrop-blur-sm"
                                  >
                                    <div className="flex items-start gap-4">
                                      <span className="text-xs font-mono bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-sidebar-primary-foreground px-3 py-1.5 rounded-xl flex-shrink-0 font-bold shadow-md shadow-sidebar-primary/20">
                                        {source.index}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2.5">
                                          <div className="text-sm font-bold truncate text-foreground">{source.title}</div>
                                          {source.score && (
                                            <span className="text-xs font-semibold px-3 py-1.5 bg-sidebar-primary/10 text-sidebar-primary rounded-lg border border-sidebar-primary/20 shadow-sm">
                                              {(source.score * 100).toFixed(0)}% 相关性
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
                                          {source.content}
                                        </div>
                                        {source.datasetName && (
                                          <div className="text-xs text-muted-foreground mt-3.5 flex items-center gap-2 font-semibold">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            {source.datasetName}
                                          </div>
                                        )}
                                      </div>
                                      <svg className="w-5 h-5 flex-shrink-0 text-muted-foreground group-hover:text-sidebar-primary group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 智能体思考状态展示 */}
          {showAgentThinking && (
            <div className="max-w-7xl mx-auto w-full px-20 py-6">
              <div className="w-[870px] max-w-full mx-auto flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl border border-primary/10 backdrop-blur-sm animate-pulse">
                {/* 动画加载图标 */}
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 border-2 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-2 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-2 border-2 border-transparent border-t-primary/60 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
                </div>

                {/* 提示文字 */}
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground flex items-center gap-2">
                    智能体正在执行任务
                    <span className="inline-flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    正在分析您的问题，请稍候...
                  </div>
                </div>

                {/* 装饰性光晕 */}
                <div className="w-2 h-2 rounded-full bg-primary/40 animate-ping"></div>
              </div>
            </div>
          )}

          {/* 一键到底部按钮 */}
          {showScrollToBottom && (
            <button
              onClick={() => {
                if (messagesContainerRef.current) {
                  messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                  setShouldAutoScroll(true); // 恢复自动滚动
                  setShowScrollToBottom(false); // 隐藏按钮
                }
              }}
              className="fixed bottom-36 right-8 w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 hover:from-sidebar-primary hover:to-sidebar-primary/90 text-sidebar-primary-foreground shadow-xl shadow-sidebar-primary/30 hover:shadow-2xl hover:shadow-sidebar-primary/40 transition-all duration-300 hover:scale-110 z-50"
              title="滚动到底部"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>

        {/* 输入框 */}
        <div className="bg-gradient-to-t from-background/95 via-background/90 to-background/80 backdrop-blur-2xl pt-4 pb-6">
          <div className="max-w-5xl mx-auto w-full px-6">
            {/* 文件列表 */}
            {selectedFiles.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2.5">
                {selectedFiles.map((file, index) => {
                  const isImage = isImageFile(file);
                  return (
                    <div
                      key={index}
                      className="group flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-sidebar-primary/10 via-sidebar-primary/5 to-sidebar-primary/10 rounded-2xl text-sm border border-sidebar-primary/20 hover:border-sidebar-primary/40 transition-all duration-300 hover:shadow-md hover:shadow-sidebar-primary/10"
                    >
                      {isImage ? (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sidebar-primary/20 to-sidebar-primary/10 flex items-center justify-center flex-shrink-0 border border-sidebar-primary/20 overflow-hidden">
                          <img
                            src={getImagePreviewUrl(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sidebar-primary/20 to-sidebar-primary/10 flex items-center justify-center flex-shrink-0 border border-sidebar-primary/20">
                          <svg className="w-4 h-4 text-sidebar-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <span className="max-w-[200px] truncate font-medium text-foreground">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200 hover:scale-110"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 输入区域容器 */}
            <div className="flex gap-3.5 items-end bg-gradient-to-br from-background via-muted/10 to-background rounded-2xl p-4 shadow-2xl shadow-black/5 hover:shadow-2xl hover:shadow-sidebar-primary/5 transition-all duration-300 backdrop-blur-xl border border-border/30">
              {/* 文件上传按钮 */}
              <label className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary via-sidebar-primary to-sidebar-primary/80 hover:from-sidebar-primary/90 hover:via-sidebar-primary/90 hover:to-sidebar-primary/70 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-sidebar-primary/40 group relative overflow-hidden backdrop-blur-md border border-white/10">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isLoading || isUploading}
                />
                {/* 光晕效果 */}
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <svg className="w-6 h-6 text-sidebar-primary-foreground relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </label>

              <div className="flex-1 relative group">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Enter发送，Shift+Enter换行)"
                  className="w-full resize-none rounded-xl border-2 border-border/30 bg-background/95 px-5 py-3.5 text-base focus:outline-none focus:border-sidebar-primary/60 focus:bg-background focus:ring-4 focus:ring-sidebar-primary/5 transition-all duration-300 hover:bg-background hover:border-border/40 backdrop-blur-sm"
                  rows={2}
                  disabled={isLoading || isUploading}
                />
              </div>

              {/* 发送按钮 */}
              <button
                onClick={sendMessage}
                disabled={isLoading || isUploading || (!inputMessage.trim() && selectedFiles.length === 0)}
                className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary via-sidebar-primary to-sidebar-primary/80 hover:from-sidebar-primary/90 hover:via-sidebar-primary/90 hover:to-sidebar-primary/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-sidebar-primary/40 disabled:hover:scale-100 disabled:hover:shadow-none group relative overflow-hidden backdrop-blur-md border border-white/10`}
              >
                {/* 光晕效果 */}
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:opacity-0" />
                {isLoading ? (
                  <svg className="w-5 h-5 text-sidebar-primary-foreground animate-spin relative z-10" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-sidebar-primary-foreground relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>

            {/* 文件格式提示 */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
              <p className="text-xs text-muted-foreground/70 font-medium">
                内容由AI生成
              </p>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/50"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 知识库来源详情弹窗 */}
      {selectedSource && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSource(null)}
        >
          <div
            className="bg-background/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/30 max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto border border-border/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono bg-gradient-to-br from-primary to-primary/80 text-white px-3 py-1.5 rounded-xl font-bold shadow-md shadow-primary/20">
                    [{selectedSource.index}]
                  </span>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    {selectedSource.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-2.5 hover:bg-muted/80 rounded-xl transition-all duration-200 hover:scale-110"
                >
                  <svg className="w-6 h-6 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 来源和分数 */}
              <div className="flex items-center gap-4 mb-6">
                {/* 来源（知识库名称） */}
                {selectedSource.datasetName && (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 rounded-xl border border-border/30 backdrop-blur-sm">
                    <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <div className="text-sm">
                      <span className="text-muted-foreground">来源：</span>
                      <span className="font-semibold text-foreground">{selectedSource.datasetName}</span>
                    </div>
                  </div>
                )}

                {/* 分数 */}
                {selectedSource.score && (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-sidebar-primary/15 via-sidebar-primary/10 to-sidebar-primary/15 rounded-xl border border-sidebar-primary/30 backdrop-blur-sm">
                    <svg className="w-5 h-5 text-sidebar-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <div className="text-sm">
                      <span className="text-muted-foreground">相关性：</span>
                      <span className="font-bold text-sidebar-primary">
                        {(selectedSource.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-foreground/90">
                {selectedSource.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全局提示 Toast */}
      {newConversationToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="px-6 py-3 bg-background border border-border/50 shadow-xl rounded-2xl flex items-center gap-3 backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-sidebar-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-foreground">{newConversationToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
