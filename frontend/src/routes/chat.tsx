import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  connectWifi,
  disconnectWifi,
  listDevices,
  getConfig,
  saveConfig,
  type Device,
  type ConfigSaveRequest,
} from '../api';
import { DeviceSidebar } from '../components/DeviceSidebar';
import { DevicePanel } from '../components/DevicePanel';
import { ChatKitPanel } from '../components/ChatKitPanel';
import { Toast, type ToastType } from '../components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  ExternalLink,
  Zap,
  Brain,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '../lib/i18n-context';

// 预设配置选项
const PRESET_CONFIGS = [
  {
    name: 'bigmodel',
    config: {
      base_url: 'https://open.bigmodel.cn/api/paas/v4',
      model_name: 'autoglm-phone',
      api_key: '',
    },
    apiKeyUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
  },
  {
    name: 'modelscope',
    config: {
      base_url: 'https://api-inference.modelscope.cn/v1',
      model_name: 'ZhipuAI/AutoGLM-Phone-9B',
      api_key: '',
    },
    apiKeyUrl: 'https://www.modelscope.cn/my/myaccesstoken',
  },
  {
    name: 'custom',
    config: {
      base_url: '',
      model_name: 'autoglm-phone-9b',
      api_key: '',
    },
  },
] as const;

export const Route = createFileRoute('/chat')({
  component: ChatComponent,
});

function ChatComponent() {
  const t = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [deviceThinkingModes, setDeviceThinkingModes] = useState<
    Record<string, 'fast' | 'deep'>
  >({});
  // Chat mode: 'classic' for DevicePanel, 'chatkit' for ChatKitPanel (layered agent)
  const [chatMode, setChatMode] = useState<'classic' | 'chatkit'>('classic');
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  };

  const [config, setConfig] = useState<ConfigSaveRequest | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDecisionApiKey, setShowDecisionApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tempConfig, setTempConfig] = useState({
    base_url: '',
    model_name: '',
    api_key: '',
    thinking_mode: 'deep' as 'fast' | 'deep',
    dual_model_enabled: false,
    decision_base_url: '',
    decision_model_name: '',
    decision_api_key: '',
  });

  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        const data = await getConfig();
        setConfig({
          base_url: data.base_url,
          model_name: data.model_name,
          api_key: data.api_key || undefined,
          thinking_mode: data.thinking_mode || 'deep',
          dual_model_enabled: data.dual_model_enabled || false,
          decision_base_url: data.decision_base_url || undefined,
          decision_model_name: data.decision_model_name || undefined,
          decision_api_key: data.decision_api_key || undefined,
        });
        setTempConfig({
          base_url: data.base_url,
          model_name: data.model_name,
          api_key: data.api_key || '',
          thinking_mode: (data.thinking_mode as 'fast' | 'deep') || 'deep',
          dual_model_enabled: data.dual_model_enabled || false,
          decision_base_url: data.decision_base_url || '',
          decision_model_name: data.decision_model_name || '',
          decision_api_key: data.decision_api_key || '',
        });

        if (!data.base_url) {
          setShowConfig(true);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        setShowConfig(true);
      }
    };

    loadConfiguration();
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const response = await listDevices();

      const deviceMap = new Map<string, Device>();
      const serialMap = new Map<string, Device[]>();

      for (const device of response.devices) {
        if (device.serial) {
          const group = serialMap.get(device.serial) || [];
          group.push(device);
          serialMap.set(device.serial, group);
        } else {
          deviceMap.set(device.id, device);
        }
      }

      Array.from(serialMap.values()).forEach(devices => {
        const remoteDevice = devices.find(
          (d: Device) => d.connection_type === 'remote'
        );
        const selectedDevice = remoteDevice || devices[0];
        deviceMap.set(selectedDevice.id, selectedDevice);
      });

      const filteredDevices = Array.from(deviceMap.values());
      setDevices(filteredDevices);

      if (filteredDevices.length > 0 && !currentDeviceId) {
        setCurrentDeviceId(filteredDevices[0].id);
      }

      if (
        currentDeviceId &&
        !filteredDevices.find(d => d.id === currentDeviceId)
      ) {
        setCurrentDeviceId(filteredDevices[0]?.id || '');
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  }, [currentDeviceId]);

  useEffect(() => {
    // Initial load with a small delay to avoid synchronous setState
    const timeoutId = setTimeout(() => {
      loadDevices();
    }, 0);

    // Set up interval for periodic updates
    const intervalId = setInterval(loadDevices, 3000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [loadDevices]);

  const handleSaveConfig = async () => {
    if (!tempConfig.base_url) {
      showToast(t.chat.baseUrlRequired, 'error');
      return;
    }

    try {
      await saveConfig({
        base_url: tempConfig.base_url,
        model_name: tempConfig.model_name || 'autoglm-phone-9b',
        api_key: tempConfig.api_key || undefined,
        thinking_mode: tempConfig.thinking_mode,
        dual_model_enabled: tempConfig.dual_model_enabled,
        decision_base_url: tempConfig.decision_base_url || undefined,
        decision_model_name: tempConfig.decision_model_name || undefined,
        decision_api_key: tempConfig.decision_api_key || undefined,
      });

      setConfig({
        base_url: tempConfig.base_url,
        model_name: tempConfig.model_name,
        api_key: tempConfig.api_key || undefined,
        thinking_mode: tempConfig.thinking_mode,
        dual_model_enabled: tempConfig.dual_model_enabled,
        decision_base_url: tempConfig.decision_base_url || undefined,
        decision_model_name: tempConfig.decision_model_name || undefined,
        decision_api_key: tempConfig.decision_api_key || undefined,
      });
      setShowConfig(false);
      showToast(t.toasts.configSaved, 'success');
    } catch (err) {
      console.error('Failed to save config:', err);
      showToast(
        `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
    }
  };

  const handleConnectWifi = async (deviceId: string) => {
    try {
      const res = await connectWifi({ device_id: deviceId });
      if (res.success && res.device_id) {
        setCurrentDeviceId(res.device_id);
        showToast(t.toasts.wifiConnected, 'success');
      } else if (!res.success) {
        showToast(
          res.message || res.error || t.toasts.connectionFailed,
          'error'
        );
      }
    } catch (e) {
      showToast(t.toasts.wifiConnectionError, 'error');
      console.error('Connect WiFi error:', e);
    }
  };

  const handleDisconnectWifi = async (deviceId: string) => {
    try {
      const res = await disconnectWifi(deviceId);
      if (res.success) {
        showToast(t.toasts.wifiDisconnected, 'success');
      } else {
        showToast(
          res.message || res.error || t.toasts.disconnectFailed,
          'error'
        );
      }
    } catch (e) {
      showToast(t.toasts.wifiDisconnectError, 'error');
      console.error('Disconnect WiFi error:', e);
    }
  };

  return (
    <div className="h-full flex relative min-h-0">
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      )}

      {/* Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="sm:max-w-md h-[75vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#1d9bf0]" />
              {t.chat.configuration}
            </DialogTitle>
            <DialogDescription>{t.chat.configureApi}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {/* 预设配置选项 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t.chat.selectPreset}
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {PRESET_CONFIGS.map(preset => (
                  <div key={preset.name} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setTempConfig(prev => ({
                          ...prev,
                          base_url: preset.config.base_url,
                          model_name: preset.config.model_name,
                          api_key: preset.config.api_key,
                        }))
                      }
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        tempConfig.base_url === preset.config.base_url &&
                        (preset.name !== 'custom' ||
                          (preset.name === 'custom' &&
                            tempConfig.base_url === ''))
                          ? 'border-[#1d9bf0] bg-[#1d9bf0]/5'
                          : 'border-slate-200 dark:border-slate-700 hover:border-[#1d9bf0]/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Server
                          className={`w-4 h-4 ${
                            tempConfig.base_url === preset.config.base_url &&
                            (preset.name !== 'custom' ||
                              (preset.name === 'custom' &&
                                tempConfig.base_url === ''))
                              ? 'text-[#1d9bf0]'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                        <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {
                            t.presetConfigs[
                              preset.name as keyof typeof t.presetConfigs
                            ].name
                          }
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">
                        {
                          t.presetConfigs[
                            preset.name as keyof typeof t.presetConfigs
                          ].description
                        }
                      </p>
                    </button>
                    {'apiKeyUrl' in preset && (
                      <a
                        href={preset.apiKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group"
                        title={t.chat.getApiKey || '获取 API Key'}
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1d9bf0] transition-colors" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_url">{t.chat.baseUrl} *</Label>
              <Input
                id="base_url"
                value={tempConfig.base_url}
                onChange={e =>
                  setTempConfig({ ...tempConfig, base_url: e.target.value })
                }
                placeholder="http://localhost:8080/v1"
              />
              {!tempConfig.base_url && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {t.chat.baseUrlRequired}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="api_key">{t.chat.apiKey}</Label>
              <div className="relative">
                <Input
                  id="api_key"
                  type={showApiKey ? 'text' : 'password'}
                  value={tempConfig.api_key}
                  onChange={e =>
                    setTempConfig({ ...tempConfig, api_key: e.target.value })
                  }
                  placeholder="Leave empty if not required"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model_name">{t.chat.modelName}</Label>
              <Input
                id="model_name"
                value={tempConfig.model_name}
                onChange={e =>
                  setTempConfig({ ...tempConfig, model_name: e.target.value })
                }
                placeholder="autoglm-phone-9b"
              />
            </div>

            {/* 思考模式选项 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t.chat.thinkingMode || '思考模式'}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setTempConfig({ ...tempConfig, thinking_mode: 'fast' })
                  }
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    tempConfig.thinking_mode === 'fast'
                      ? 'border-[#1d9bf0] bg-[#1d9bf0]/5'
                      : 'border-slate-200 dark:border-slate-700 hover:border-[#1d9bf0]/50'
                  }`}
                >
                  <Zap
                    className={`w-4 h-4 ${
                      tempConfig.thinking_mode === 'fast'
                        ? 'text-[#1d9bf0]'
                        : 'text-slate-400'
                    }`}
                  />
                  <div className="text-left">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {t.chat.fastMode || '快速响应'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.chat.fastModeDesc || '减少思考时间'}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setTempConfig({ ...tempConfig, thinking_mode: 'deep' })
                  }
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    tempConfig.thinking_mode === 'deep'
                      ? 'border-[#1d9bf0] bg-[#1d9bf0]/5'
                      : 'border-slate-200 dark:border-slate-700 hover:border-[#1d9bf0]/50'
                  }`}
                >
                  <Brain
                    className={`w-4 h-4 ${
                      tempConfig.thinking_mode === 'deep'
                        ? 'text-[#1d9bf0]'
                        : 'text-slate-400'
                    }`}
                  />
                  <div className="text-left">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {t.chat.deepMode || '深度思考'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.chat.deepModeDesc || '完整分析过程'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 高级设置：决策模型配置 */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-[#1d9bf0] transition-colors"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {t.chat.advancedSettings || '高级设置（决策模型）'}
              </button>

              {showAdvanced && (
                <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                  <div className="space-y-2">
                    <Label htmlFor="decision_base_url">
                      {t.chat.decisionBaseUrl || '决策模型 Base URL'}
                    </Label>
                    <Input
                      id="decision_base_url"
                      value={tempConfig.decision_base_url}
                      onChange={e =>
                        setTempConfig({
                          ...tempConfig,
                          decision_base_url: e.target.value,
                        })
                      }
                      placeholder="https://api-inference.modelscope.cn/v1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="decision_model_name">
                      {t.chat.decisionModelName || '决策模型名称'}
                    </Label>
                    <Input
                      id="decision_model_name"
                      value={tempConfig.decision_model_name}
                      onChange={e =>
                        setTempConfig({
                          ...tempConfig,
                          decision_model_name: e.target.value,
                        })
                      }
                      placeholder="ZhipuAI/GLM-4.7"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="decision_api_key">
                      {t.chat.decisionApiKey || '决策模型 API Key'}
                    </Label>
                    <div className="relative">
                      <Input
                        id="decision_api_key"
                        type={showDecisionApiKey ? 'text' : 'password'}
                        value={tempConfig.decision_api_key}
                        onChange={e =>
                          setTempConfig({
                            ...tempConfig,
                            decision_api_key: e.target.value,
                          })
                        }
                        placeholder="Leave empty if not required"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setShowDecisionApiKey(!showDecisionApiKey)
                        }
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      >
                        {showDecisionApiKey ? (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfig(false);
                if (config) {
                  setTempConfig({
                    base_url: config.base_url,
                    model_name: config.model_name,
                    api_key: config.api_key || '',
                    thinking_mode:
                      (config.thinking_mode as 'fast' | 'deep') || 'deep',
                    dual_model_enabled: config.dual_model_enabled || false,
                    decision_base_url: config.decision_base_url || '',
                    decision_model_name: config.decision_model_name || '',
                    decision_api_key: config.decision_api_key || '',
                  });
                }
              }}
            >
              {t.chat.cancel}
            </Button>
            <Button onClick={handleSaveConfig} variant="twitter">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {t.chat.saveConfig}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sidebar */}
      <DeviceSidebar
        devices={devices}
        currentDeviceId={currentDeviceId}
        onSelectDevice={setCurrentDeviceId}
        onOpenConfig={() => setShowConfig(true)}
        onConnectWifi={handleConnectWifi}
        onDisconnectWifi={handleDisconnectWifi}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Mode Toggle - Floating Capsule */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-full p-1 shadow-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setChatMode('classic')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                chatMode === 'classic'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {t.chatkit?.classicMode || '经典模式'}
            </button>
            <button
              onClick={() => setChatMode('chatkit')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                chatMode === 'chatkit'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" />
              {t.chatkit?.layeredMode || '分层代理'}
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex items-stretch justify-center min-h-0 px-4 py-4 pt-16">
          {devices.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {t.chat.welcomeTitle}
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  {t.chat.connectDevice}
                </p>
              </div>
            </div>
          ) : (
            devices.map(device => (
              <div
                key={device.serial}
                className={`w-full max-w-7xl flex items-stretch justify-center min-h-0 ${
                  device.id === currentDeviceId ? '' : 'hidden'
                }`}
              >
                {chatMode === 'classic' ? (
                  <DevicePanel
                    deviceId={device.id}
                    deviceSerial={device.serial}
                    deviceName={device.model}
                    config={config}
                    isVisible={device.id === currentDeviceId}
                    isConfigured={!!config?.base_url}
                    thinkingMode={deviceThinkingModes[device.serial] || 'fast'}
                    onThinkingModeChange={mode => {
                      setDeviceThinkingModes(prev => ({
                        ...prev,
                        [device.serial]: mode,
                      }));
                    }}
                  />
                ) : (
                  <ChatKitPanel
                    deviceId={device.id}
                    deviceName={device.model}
                    isVisible={device.id === currentDeviceId}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
