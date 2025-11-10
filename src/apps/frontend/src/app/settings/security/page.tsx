'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';

export default function SecurityPage() {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = () => {
    if (formData.newPassword !== formData.confirmPassword) {
      alert('两次输入的密码不一致！');
      return;
    }
    if (formData.newPassword.length < 6) {
      alert('新密码长度不能少于6位！');
      return;
    }
    // 实际项目：提交密码修改请求
    alert('密码修改成功！请重新登录');
    setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">账号安全</h1>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Label htmlFor="oldPassword" className="flex items-center">
                原密码
              </Label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                value={formData.oldPassword}
                onChange={handleInputChange}
                className="md:col-span-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Label htmlFor="newPassword" className="flex items-center">
                新密码
              </Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                className="md:col-span-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Label htmlFor="confirmPassword" className="flex items-center">
                确认新密码
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="md:col-span-2"
              />
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={handleChangePassword} className="bg-blue-600 hover:bg-blue-700">
                确认修改
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>安全设置</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">手机验证</h4>
                <p className="text-sm text-gray-500">已绑定手机号：138****1234</p>
              </div>
              <Button variant="secondary">更换手机号</Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">登录保护</h4>
                <p className="text-sm text-gray-500">开启后，异地登录需验证</p>
              </div>
              <Button variant="secondary">开启保护</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}