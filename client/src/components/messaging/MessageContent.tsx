import { Link } from "wouter";

interface MessageContentProps {
  content: string;
  className?: string;
}

export function MessageContent({ content, className = "" }: MessageContentProps) {
  const parseContent = (text: string) => {
    const parts: Array<{ type: 'text' | 'station' | 'workorder' | 'mention' | 'url', content: string, meta?: any }> = [];
    
    const patterns = [
      { type: 'station', regex: /station:\/\/([A-Za-z0-9-]+)/gi },
      { type: 'workorder', regex: /workorder:\/\/([A-Za-z0-9-]+)/gi },
      { type: 'mention', regex: /\B@([\w-]+)/g },
      { type: 'url', regex: /(https?:\/\/[^\s]+)/g }
    ];

    let lastIndex = 0;
    const matches: Array<{ start: number, end: number, type: string, content: string, match: string }> = [];

    patterns.forEach(({ type, regex }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          content: match[1] || match[0],
          match: match[0]
        });
      }
    });

    matches.sort((a, b) => a.start - b.start);

    matches.forEach((match, i) => {
      if (match.start > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.start) });
      }
      parts.push({ type: match.type as any, content: match.content, meta: match.match });
      lastIndex = match.end;
    });

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, content: text }];
  };

  const renderPart = (part: ReturnType<typeof parseContent>[0], index: number) => {
    switch (part.type) {
      case 'station':
        return (
          <Link
            key={index}
            href={`/stations/${part.content}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono text-sm hover:bg-blue-200 transition-colors"
            data-testid={`link-station-${part.content}`}
          >
            <span className="text-xs">🏪</span>
            {part.content}
          </Link>
        );
      
      case 'workorder':
        return (
          <Link
            key={index}
            href={`/work-orders/${part.content}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-mono text-sm hover:bg-amber-200 transition-colors"
            data-testid={`link-workorder-${part.content}`}
          >
            <span className="text-xs">🔧</span>
            {part.content}
          </Link>
        );
      
      case 'mention':
        return (
          <span
            key={index}
            className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium text-sm"
            data-testid={`mention-${part.content}`}
          >
            @{part.content}
          </span>
        );
      
      case 'url':
        return (
          <a
            key={index}
            href={part.meta}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
            data-testid="link-external"
          >
            {part.meta}
          </a>
        );
      
      default:
        return <span key={index}>{part.content}</span>;
    }
  };

  const parts = parseContent(content);

  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, index) => renderPart(part, index))}
    </div>
  );
}
