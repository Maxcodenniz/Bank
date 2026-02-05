import React, { useState, useEffect, useRef, startTransition } from 'react';
import { X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface LogEntry {
  id: number;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

const MobileConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Check if console should be enabled (development mode or ?console=true in URL)
  const shouldShow = 
    import.meta.env.DEV || 
    new URLSearchParams(window.location.search).get('console') === 'true' ||
    localStorage.getItem('mobileConsoleEnabled') === 'true';

  // Define addLog before useEffect so it can be used in the closure
  // Use startTransition to avoid React warnings about updating during render
  const addLog = React.useCallback((type: LogEntry['type'], message: string) => {
    const newLog: LogEntry = {
      id: logIdRef.current++,
      type,
      message: message.substring(0, 1000), // Increased limit
      timestamp: new Date()
    };

    // Use startTransition to defer state update and avoid render warnings
    startTransition(() => {
      setLogs(prev => {
        const updated = [...prev, newLog];
        // Keep only last 200 logs
        return updated.slice(-200);
      });
    });
  }, []);

  // Load buffered logs from early initialization
  useEffect(() => {
    if (!shouldShow) return;
    
    const buffer = (window as any).__consoleLogBuffer;
    if (buffer && buffer.length > 0) {
      console.log(`📱 Loading ${buffer.length} buffered logs...`);
      buffer.forEach((bufferedLog: any) => {
        addLog(bufferedLog.type, bufferedLog.message);
      });
      // Clear buffer after loading
      (window as any).__consoleLogBuffer = [];
    }
  }, [shouldShow, addLog]);

  useEffect(() => {
    if (!shouldShow) return;

    // Get original console methods (either from window or current console)
    const originalLog = (window as any).__originalConsole?.log || console.log;
    const originalError = (window as any).__originalConsole?.error || console.error;
    const originalWarn = (window as any).__originalConsole?.warn || console.warn;
    const originalInfo = (window as any).__originalConsole?.info || console.info;

    // Helper to format log messages
    const formatMessage = (args: any[]): string => {
      return args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    // Override console methods to also add to our log list
    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      // Use setTimeout to defer state update
      setTimeout(() => addLog('log', formatMessage(args)), 0);
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      setTimeout(() => addLog('error', formatMessage(args)), 0);
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      setTimeout(() => addLog('warn', formatMessage(args)), 0);
    };

    console.info = (...args: any[]) => {
      originalInfo.apply(console, args);
      setTimeout(() => addLog('info', formatMessage(args)), 0);
    };

    // Add a test log to verify it's working
    setTimeout(() => {
      console.log('📱 Mobile Console component initialized and ready!');
    }, 100);

    // Don't restore on unmount - keep console override active
    // The early initialization will handle cleanup if needed
  }, [shouldShow, addLog]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isOpen && !isMinimized && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, isMinimized]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setIsMinimized(false);
        }}
        className="fixed bottom-4 right-4 z-[9999] bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-2xl transition-all flex items-center justify-center"
        title="Toggle Console"
        style={{ width: '48px', height: '48px', minWidth: '48px' }}
      >
        {isOpen ? <X className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        {logs.length > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {logs.length > 99 ? '99+' : logs.length}
          </span>
        )}
      </button>

      {/* Console Panel */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-gray-900 border-t border-gray-700 shadow-2xl">
          {/* Header */}
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold text-sm">Console ({logs.length})</h3>
              <button
                onClick={clearLogs}
                className="text-gray-400 hover:text-white p-1"
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-400 hover:text-white p-1"
            >
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Logs Container */}
          {!isMinimized && (
            <div className="h-64 overflow-y-auto bg-black/50 p-2 space-y-1 text-xs font-mono">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No logs yet...</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={`${getLogColor(log.type)} break-words px-2 py-1 rounded`}
                  >
                    <span className="text-gray-500 text-[10px]">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    {' '}
                    <span className="font-semibold">[{log.type.toUpperCase()}]</span>
                    {' '}
                    {log.message}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MobileConsole;
