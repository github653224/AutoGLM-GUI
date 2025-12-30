import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '../lib/i18n-context';
import { ScrcpyPlayer } from './ScrcpyPlayer';
import {
  Video,
  Image as ImageIcon,
  MonitorPlay,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
  RotateCcw,
  Layers,
  MessageSquare,
  Wrench,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ScreenshotResponse } from '../api';
import { getScreenshot } from '../api';

interface ChatKitPanelProps {
  deviceId: string;
  deviceName: string;
  isVisible: boolean;
}

// 执行步骤类型
interface ExecutionStep {
  id: string;
  type: 'user' | 'thinking' | 'tool_call' | 'tool_result' | 'assistant';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  timestamp: Date;
  isExpanded?: boolean;
}

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  steps?: ExecutionStep[];
  isStreaming?: boolean;
  success?: boolean;
}

export function ChatKitPanel({
  deviceId,
  deviceName,
  isVisible,
}: ChatKitPanelProps) {
  const t = useTranslation();

  // Chat state
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  // Screen display state
  const [useVideoStream, setUseVideoStream] = React.useState(true);
  const [videoStreamFailed, setVideoStreamFailed] = React.useState(false);
  const [displayMode, setDisplayMode] = React.useState<
    'auto' | 'video' | 'screenshot'
  >('auto');
  const [screenshot, setScreenshot] = React.useState<ScreenshotResponse | null>(
    null
  );
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(
    null
  );
  const [feedbackType, setFeedbackType] = React.useState<
    'tap' | 'swipe' | 'error' | 'success'
  >('success');
  const feedbackTimeoutRef = React.useRef<number | null>(null);

  // Control area state
  const [showControlArea, setShowControlArea] = React.useState(false);
  const [showControls, setShowControls] = React.useState(false);
  const controlsTimeoutRef = React.useRef<number | null>(null);
  const videoStreamRef = React.useRef<{ close: () => void } | null>(null);
  const screenshotFetchingRef = React.useRef(false);

  const showFeedback = (
    message: string,
    duration = 2000,
    type: 'tap' | 'swipe' | 'error' | 'success' = 'success'
  ) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedbackType(type);
    setFeedbackMessage(message);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackMessage(null);
    }, duration);
  };

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControlArea(true);
  };

  const handleMouseLeave = () => {
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControlArea(false);
    }, 500);
  };

  React.useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const toggleControls = () => {
    setShowControls(prev => !prev);
  };

  React.useEffect(() => {
    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.close();
      }
    };
  }, [deviceId]);

  // Screenshot polling
  React.useEffect(() => {
    if (!deviceId || !isVisible) return;

    const shouldPollScreenshots =
      displayMode === 'screenshot' ||
      (displayMode === 'auto' && videoStreamFailed);

    if (!shouldPollScreenshots) {
      return;
    }

    const fetchScreenshot = async () => {
      if (screenshotFetchingRef.current) return;

      screenshotFetchingRef.current = true;
      try {
        const data = await getScreenshot(deviceId);
        if (data.success) {
          setScreenshot(data);
        }
      } catch (e) {
        console.error('Failed to fetch screenshot:', e);
      } finally {
        screenshotFetchingRef.current = false;
      }
    };

    fetchScreenshot();
    const interval = setInterval(fetchScreenshot, 500);

    return () => clearInterval(interval);
  }, [deviceId, videoStreamFailed, displayMode, isVisible]);

  const handleVideoStreamReady = React.useCallback(
    (stream: { close: () => void } | null) => {
      videoStreamRef.current = stream;
    },
    []
  );

  const handleFallback = React.useCallback(() => {
    setVideoStreamFailed(true);
    setUseVideoStream(false);
  }, []);

  const toggleDisplayMode = (mode: 'auto' | 'video' | 'screenshot') => {
    setDisplayMode(mode);
  };

  // Toggle step expansion
  const toggleStepExpansion = (messageId: string, stepId: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              steps: msg.steps?.map(step =>
                step.id === stepId
                  ? { ...step, isExpanded: !step.isExpanded }
                  : step
              ),
            }
          : msg
      )
    );
  };

  // Send message using Layered Agent API
  const handleSend = React.useCallback(async () => {
    const inputValue = input.trim();
    if (!inputValue || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    const agentMessageId = (Date.now() + 1).toString();
    const agentMessage: Message = {
      id: agentMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      steps: [],
      isStreaming: true,
    };

    setMessages(prev => [...prev, agentMessage]);

    try {
      // Use simplified layered agent API
      const response = await fetch('/api/layered-agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          device_id: deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const steps: ExecutionStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Handle different event types from layered agent API
              if (data.type === 'tool_call') {
                // Tool call step
                const step: ExecutionStep = {
                  id: `step-${Date.now()}-${Math.random()}`,
                  type: 'tool_call',
                  content:
                    data.tool_name === 'chat'
                      ? `发送指令给 Phone Agent`
                      : data.tool_name === 'list_devices'
                        ? '获取设备列表'
                        : `调用工具: ${data.tool_name}`,
                  toolName: data.tool_name,
                  toolArgs: data.tool_args || {},
                  timestamp: new Date(),
                  isExpanded: true,
                };
                steps.push(step);
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === agentMessageId
                      ? { ...msg, steps: [...steps] }
                      : msg
                  )
                );
              } else if (data.type === 'tool_result') {
                // Tool result
                const step: ExecutionStep = {
                  id: `step-${Date.now()}-${Math.random()}`,
                  type: 'tool_result',
                  content:
                    data.tool_name === 'chat'
                      ? 'Phone Agent 执行结果'
                      : `${data.tool_name} 结果`,
                  toolResult: data.result,
                  timestamp: new Date(),
                  isExpanded: true,
                };
                steps.push(step);
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === agentMessageId
                      ? { ...msg, steps: [...steps] }
                      : msg
                  )
                );
              } else if (data.type === 'message') {
                // Intermediate message
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === agentMessageId
                      ? { ...msg, content: data.content }
                      : msg
                  )
                );
              } else if (data.type === 'done') {
                // Final response
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === agentMessageId
                      ? {
                          ...msg,
                          content: data.content || msg.content,
                          isStreaming: false,
                          success: data.success,
                        }
                      : msg
                  )
                );
              } else if (data.type === 'error') {
                // Error
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === agentMessageId
                      ? {
                          ...msg,
                          content: `错误: ${data.message}`,
                          isStreaming: false,
                          success: false,
                        }
                      : msg
                  )
                );
                setError(data.message);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, line);
            }
          }
        }
      }

      // Mark as complete if not already
      setMessages(prev =>
        prev.map(msg =>
          msg.id === agentMessageId && msg.isStreaming
            ? { ...msg, isStreaming: false, success: true }
            : msg
        )
      );
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMessages(prev =>
        prev.map(msg =>
          msg.id === agentMessageId
            ? {
                ...msg,
                content: `错误: ${err instanceof Error ? err.message : 'Unknown error'}`,
                isStreaming: false,
                success: false,
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, deviceId]);

  const handleReset = React.useCallback(() => {
    setMessages([]);
    setError(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex gap-4 p-4 items-stretch justify-center min-h-0">
      {/* Chat Area with Execution Steps */}
      <Card className="flex-1 flex flex-col min-h-0 max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
              <Layers className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">
                {t.chatkit?.title || 'AI Agent'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {deviceName} • {t.chatkit?.layeredAgent || '分层代理模式'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
              GLM-4.7 + Phone
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8 rounded-full"
              title="重置对话"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Messages with Execution Steps */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
                  <Layers className="h-8 w-8 text-purple-500" />
                </div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {t.chatkit?.title || '分层代理模式'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                  GLM-4.7 负责规划任务，autoglm-phone
                  负责执行。你可以看到每一步的执行过程。
                </p>
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className="space-y-2">
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%]">
                        <div className="bg-purple-600 text-white px-4 py-2 rounded-2xl rounded-br-sm">
                          <p className="whitespace-pre-wrap">
                            {message.content}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 text-right">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Execution Steps */}
                      {message.steps && message.steps.length > 0 && (
                        <div className="space-y-2">
                          {message.steps.map((step, idx) => (
                            <div
                              key={step.id}
                              className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                            >
                              {/* Step Header */}
                              <button
                                onClick={() =>
                                  toggleStepExpansion(message.id, step.id)
                                }
                                className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                                      step.type === 'tool_call'
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                    }`}
                                  >
                                    {step.type === 'tool_call' ? (
                                      <Wrench className="w-3 h-3" />
                                    ) : (
                                      <MessageSquare className="w-3 h-3" />
                                    )}
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Step {idx + 1}: {step.content}
                                  </span>
                                </div>
                                {step.isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </button>

                              {/* Step Content */}
                              {step.isExpanded && (
                                <div className="px-3 pb-3 space-y-2">
                                  {step.type === 'tool_call' &&
                                    step.toolArgs && (
                                      <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-sm">
                                        <p className="text-xs text-slate-500 mb-1 font-medium">
                                          {step.toolName === 'chat'
                                            ? '发送给 Phone Agent 的指令:'
                                            : '工具参数:'}
                                        </p>
                                        {step.toolName === 'chat' ? (
                                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                            {(
                                              step.toolArgs as {
                                                message?: string;
                                              }
                                            ).message ||
                                              JSON.stringify(
                                                step.toolArgs,
                                                null,
                                                2
                                              )}
                                          </p>
                                        ) : (
                                          <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto">
                                            {JSON.stringify(
                                              step.toolArgs,
                                              null,
                                              2
                                            )}
                                          </pre>
                                        )}
                                      </div>
                                    )}
                                  {step.type === 'tool_result' &&
                                    step.toolResult && (
                                      <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-sm">
                                        <p className="text-xs text-slate-500 mb-1 font-medium">
                                          执行结果:
                                        </p>
                                        <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap">
                                          {typeof step.toolResult === 'string'
                                            ? step.toolResult
                                            : JSON.stringify(
                                                step.toolResult,
                                                null,
                                                2
                                              )}
                                        </pre>
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Final Response */}
                      {message.content && (
                        <div className="flex justify-start">
                          <div
                            className={`max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 ${
                              message.success === false
                                ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {message.success !== undefined && (
                                <CheckCircle2
                                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                                    message.success
                                      ? 'text-green-500'
                                      : 'text-red-500'
                                  }`}
                                />
                              )}
                              <p className="whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Streaming indicator */}
                      {message.isStreaming && !message.content && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          正在思考和执行...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-end gap-3">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="描述你想要完成的任务... (Cmd+Enter 发送)"
              disabled={loading}
              className="flex-1 min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-10 w-10 rounded-full flex-shrink-0 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Screen preview - phone aspect ratio */}
      <Card
        className="w-[320px] flex-shrink-0 relative min-h-0 overflow-hidden bg-background"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Toggle and controls - shown on hover */}
        <div
          className={`absolute top-4 right-4 z-10 transition-opacity duration-200 ${
            showControlArea ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Control buttons - slide in/out */}
            <div
              className={`flex items-center gap-1 bg-popover/90 backdrop-blur rounded-xl p-1 shadow-lg border border-border transition-all duration-300 ${
                showControls
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none'
              }`}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleDisplayMode('auto')}
                className={`h-7 px-3 text-xs rounded-lg transition-colors ${
                  displayMode === 'auto'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {t.devicePanel?.auto || 'Auto'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleDisplayMode('video')}
                className={`h-7 px-3 text-xs rounded-lg transition-colors ${
                  displayMode === 'video'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Video className="w-3 h-3 mr-1" />
                {t.devicePanel?.video || 'Video'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleDisplayMode('screenshot')}
                className={`h-7 px-3 text-xs rounded-lg transition-colors ${
                  displayMode === 'screenshot'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <ImageIcon className="w-3 h-3 mr-1" />
                {t.devicePanel?.image || 'Image'}
              </Button>
            </div>

            {/* Toggle button - visible when control area is shown */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleControls}
              className="h-8 w-8 rounded-full bg-popover/90 backdrop-blur border border-border shadow-lg hover:bg-accent"
              title={showControls ? 'Hide controls' : 'Show controls'}
            >
              {showControls ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Current mode indicator - bottom left */}
        <div className="absolute bottom-4 left-4 z-10">
          <Badge
            variant="secondary"
            className="bg-white/90 text-slate-700 border border-slate-200 dark:bg-slate-900/90 dark:text-slate-300 dark:border-slate-700"
          >
            {displayMode === 'auto' && (t.devicePanel?.auto || 'Auto')}
            {displayMode === 'video' && (
              <>
                <MonitorPlay className="w-3 h-3 mr-1" />
                {t.devicePanel?.video || 'Video'}
              </>
            )}
            {displayMode === 'screenshot' && (
              <>
                <ImageIcon className="w-3 h-3 mr-1" />
                {t.devicePanel?.imageRefresh || 'Screenshot'}
              </>
            )}
          </Badge>
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-2 bg-[#1d9bf0] text-white text-sm rounded-xl shadow-lg">
            {feedbackType === 'error' && <AlertCircle className="w-4 h-4" />}
            {feedbackType === 'tap' && <Fingerprint className="w-4 h-4" />}
            {feedbackType === 'swipe' && <ArrowUpDown className="w-4 h-4" />}
            {feedbackType === 'success' && <CheckCircle2 className="w-4 h-4" />}
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Video stream */}
        {displayMode === 'video' ||
        (displayMode === 'auto' && useVideoStream && !videoStreamFailed) ? (
          <ScrcpyPlayer
            deviceId={deviceId}
            className="w-full h-full"
            enableControl={true}
            onFallback={handleFallback}
            onTapSuccess={() =>
              showFeedback(t.devicePanel?.tapped || 'Tapped', 2000, 'tap')
            }
            onTapError={error =>
              showFeedback(
                (t.devicePanel?.tapError || 'Tap error: {error}').replace(
                  '{error}',
                  error
                ),
                3000,
                'error'
              )
            }
            onSwipeSuccess={() =>
              showFeedback(t.devicePanel?.swiped || 'Swiped', 2000, 'swipe')
            }
            onSwipeError={error =>
              showFeedback(
                (t.devicePanel?.swipeError || 'Swipe error: {error}').replace(
                  '{error}',
                  error
                ),
                3000,
                'error'
              )
            }
            onStreamReady={handleVideoStreamReady}
            fallbackTimeout={100000}
          />
        ) : (
          /* Screenshot mode */
          <div className="w-full h-full flex items-center justify-center bg-muted/30 min-h-0">
            {screenshot && screenshot.success ? (
              <div className="relative w-full h-full flex items-center justify-center min-h-0">
                <img
                  src={`data:image/png;base64,${screenshot.image}`}
                  alt="Device Screenshot"
                  className="max-w-full max-h-full object-contain"
                  style={{
                    width:
                      screenshot.width > screenshot.height ? '100%' : 'auto',
                    height:
                      screenshot.width > screenshot.height ? 'auto' : '100%',
                  }}
                />
                {screenshot.is_sensitive && (
                  <div className="absolute top-12 right-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded-lg">
                    {t.devicePanel?.sensitiveContent || 'Sensitive Content'}
                  </div>
                )}
              </div>
            ) : screenshot?.error ? (
              <div className="text-center text-destructive">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-medium">
                  {t.devicePanel?.screenshotFailed || 'Screenshot Failed'}
                </p>
                <p className="text-xs mt-1 opacity-60">{screenshot.error}</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">
                  {t.devicePanel?.loading || 'Loading...'}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
