'use client';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

// 密码强度校验函数
const getPasswordStrength = (password: string) => {
  if (password.length < 6) return { level: 0, label: '过短', color: 'text-red-500' };
  if (password.length < 8 && /^[a-zA-Z0-9]+$/.test(password)) return { level: 1, label: '弱', color: 'text-orange-500' };
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) return { level: 2, label: '中', color: 'text-yellow-500' };
  if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password)) return { level: 3, label: '强', color: 'text-green-500' };
  return { level: 1, label: '弱', color: 'text-orange-500' };
};

export default function SecurityPage() {
  // const { refreshUser } = useUser();
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false); // 仅控制遮罩层显示
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  // 字段级错误状态 + 全局结果提示
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [globalResult, setGlobalResult] = useState<{
    type: 'success' | 'error' | '';
    text: string;
  }>({ type: '', text: '' });

  // 输入变更：清除对应字段错误和全局提示
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: '' }));
    setGlobalResult({ type: '', text: '' }); // 输入时清除全局提示
  }, []);

  // 密码显示/隐藏切换
  const togglePasswordVisibility = useCallback((field: string) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // 字段级表单验证（提交前的本地验证）
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    };

    if (!formData.oldPassword.trim()) errors.oldPassword = '原密码不能为空';
    if (!formData.newPassword.trim()) {
      errors.newPassword = '新密码不能为空';
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = '新密码长度不能少于6位';
    } else if (formData.newPassword === formData.oldPassword) {
      errors.newPassword = '新密码不能与原密码相同';
    }
    if (!formData.confirmPassword.trim()) {
      errors.confirmPassword = '确认新密码不能为空';
    } else if (formData.confirmPassword !== formData.newPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    setFieldErrors(errors);
    return Object.values(errors).every(err => err === '');
  };

  // 修改密码核心逻辑：遮罩层和提示信息分离
  const handleChangePassword = async () => {
    // 本地表单验证，不通过则不显示遮罩层
    if (!validateForm()) return;

    // 验证通过，立即显示遮罩层（阻止交互）
    setIsLoading(true);
    // 清空之前的全局提示
    setGlobalResult({ type: '', text: '' });

    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/auth/update-password', {
        method: 'POST', // 明确请求方法，避免歧义
        data: {
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword,
        },
      });

      // 接口返回后，先设置结果信息
      if (res.success) {
        setGlobalResult({ type: 'success', text: res.message || '密码修改成功！' });
        setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' }); // 清空表单
      } else {
        setGlobalResult({ type: 'error', text: res.message || '修改失败，请重试' });
      }
    } catch (error) {
      const errMsg = (error as Error).message || '网络异常，修改失败';
      setGlobalResult({
        type: 'error',
        text: errMsg.includes('401') ? '原密码验证失败' : errMsg,
      });
    } finally {
      // 延迟隐藏遮罩层（确保用户看到加载状态），之后显示结果信息
      setTimeout(() => {
        setIsLoading(false);
      }, 600);
    }
  };

  // 密码强度信息
  const passwordStrength = getPasswordStrength(formData.newPassword);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">账号安全中心</h1>

      {/* 修改密码卡片 - 外层relative确保遮罩层正确定位 */}
      <div className="relative mb-8">
        {/* 遮罩层：仅覆盖卡片，层级z-20，不影响其他内容 */}
        {isLoading && (
          <div 
            className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-20 
                      rounded-xl border border-gray-100 shadow-sm"
            style={{ height: '100%', boxSizing: 'border-box' }} // 固定高度，避免抖动
          >
            <div className="flex items-center gap-3 text-gray-700">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <span className="text-base font-medium">处理中，请稍候...</span>
            </div>
          </div>
        )}

        {/* 表单卡片：层级z-10，确保在遮罩层下方 */}
        <Card className="shadow-sm border border-gray-100 transition-all hover:shadow-md relative z-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span>修改密码</span>
              <p className="text-sm font-normal text-gray-500 ml-2">定期修改密码可提升账号安全性</p>
            </CardTitle>
          </CardHeader>
          <CardContent>
          <form 
              onSubmit={(e) => {
                e.preventDefault(); // 阻止浏览器默认提交行为
                handleChangePassword(); // 复用原有提交逻辑
              }}
              className="space-y-6"
            >
              {/* 原密码输入 + 字段错误提示 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <Label htmlFor="oldPassword" className="text-gray-700 font-medium">
                  原密码 <span className="text-red-500">*</span>
                </Label>
                <div className="relative md:col-span-2 space-y-1">
                  <Input
                    id="oldPassword"
                    name="oldPassword"
                    type={showPassword.oldPassword ? 'text' : 'password'}
                    value={formData.oldPassword}
                    onChange={handleInputChange}
                    disabled={isLoading} // 加载中禁用输入框
                    placeholder="请输入当前登录密码"
                    className={`pr-10 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.oldPassword ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('oldPassword')}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword.oldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {fieldErrors.oldPassword && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} /> {fieldErrors.oldPassword}
                    </p>
                  )}
                </div>
              </div>

              {/* 新密码输入 + 强度提示 + 字段错误提示 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <Label htmlFor="newPassword" className="text-gray-700 font-medium pt-1">
                  新密码 <span className="text-red-500">*</span>
                </Label>
                <div className="md:col-span-2 space-y-1">
                  <div className="relative">
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type={showPassword.newPassword ? 'text' : 'password'}
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      placeholder="请输入6-20位新密码"
                      className={`pr-10 focus:ring-blue-500 focus:border-blue-500 ${
                        fieldErrors.newPassword ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('newPassword')}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword.newPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.newPassword && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} /> {fieldErrors.newPassword}
                    </p>
                  )}
                  {/* 修复强度提示换行问题：用flex-nowrap确保不换行，调整进度条宽度 */}
                  {formData.newPassword && !fieldErrors.newPassword && (
                    <div className="flex items-center justify-between text-sm mt-1 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <span className={`${passwordStrength.color} w-10 text-center`}>{passwordStrength.label}</span>
                        <div className="flex h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          {[0, 1, 2, 3].map((level) => (
                            <div
                              key={level}
                              className={`h-full transition-all duration-300 ${
                                level < passwordStrength.level
                                  ? passwordStrength.level === 1
                                    ? 'bg-orange-500'
                                    : passwordStrength.level === 2
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: '25%' }}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-gray-500 w-20 text-right">
                        {formData.newPassword.length}/20 字符
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    建议包含大小写字母、数字和特殊符号，提升安全性
                  </p>
                </div>
              </div>

              {/* 确认新密码 + 字段错误提示 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                  确认新密码 <span className="text-red-500">*</span>
                </Label>
                <div className="relative md:col-span-2 space-y-1">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword.confirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    placeholder="请再次输入新密码"
                    className={`pr-10 focus:ring-blue-500 focus:border-blue-500 ${
                      fieldErrors.confirmPassword ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={14} /> {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* 全局结果提示（成功/错误）：遮罩层隐藏后显示 */}
              {globalResult.text && (
                <div
                  className={`flex items-center gap-2 px-4 py-3 rounded-md text-sm ${
                    globalResult.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-100'
                      : 'bg-red-50 text-red-700 border border-red-100'
                  }`}
                >
                  {globalResult.type === 'success' ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500 shrink-0" />
                  )}
                  <span>{globalResult.text}</span>
                </div>
              )}

              {/* 确认修改按钮 */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  onClick={handleChangePassword}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors min-w-[120px]"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>处理中</span>
                    </div>
                  ) : (
                    '确认修改'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 安全设置卡片 */}
      <Card className="shadow-sm border border-gray-100 transition-all hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">安全设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 手机验证 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <span>手机验证</span>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    已绑定
                  </span>
                </h4>
                <p className="text-sm text-gray-500">已绑定手机号：138****1234</p>
              </div>
              <Button variant="secondary" className="mt-3 sm:mt-0">
                更换手机号
              </Button>
            </div>

            {/* 登录保护 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <span>登录保护</span>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    未开启
                  </span>
                </h4>
                <p className="text-sm text-gray-500">开启后，异地登录、新设备登录需验证</p>
              </div>
              <Button variant="secondary" className="mt-3 sm:mt-0">
                开启保护
              </Button>
            </div>

            {/* 登录日志入口 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="space-y-1">
                <h4 className="font-medium text-gray-900">登录日志</h4>
                <p className="text-sm text-gray-500">查看最近登录记录，发现异常及时处理</p>
              </div>
              <Button variant="secondary" className="mt-3 sm:mt-0">
                查看日志
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}