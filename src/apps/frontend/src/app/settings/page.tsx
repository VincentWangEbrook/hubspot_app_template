'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Label } from '@/src/components/ui/Label';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/Avatar';

export default function SettingsPage() {
  // 核心修复：avatar 初始化为 null（而非空字符串）
  const [userInfo, setUserInfo] = useState({
    nickname: '普通用户',
    email: 'user@example.com',
    phone: '138****1234',
    avatar: null, // 改为 null，避免空字符串 src
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 上传文件时生成临时 URL（正常逻辑）
      setUserInfo(prev => ({ ...prev, avatar: URL.createObjectURL(file) }));
    }
  };

  const handleSave = () => {
    alert('个人设置保存成功！');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">个人设置</h1>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 头像上传区域 */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                {/* 1. 优先渲染 AvatarImage（有 src 才显示） */}
                <AvatarImage 
                  src={userInfo.avatar} 
                  alt="用户头像" 
                  // 可选：传递自定义 fallbackSrc（覆盖组件默认）
                  fallbackSrc="https://via.placeholder.com/80/eeeeee/666666?text=用户"
                />
                {/* 2. AvatarImage 未渲染时，显示文字占位符 */}
                <AvatarFallback>{userInfo.nickname.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar-upload" className="block text-sm font-medium text-gray-700 mb-1">
                  上传头像
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="file:mr-4 file:py-2 file:px-4 file:border-0 file:rounded file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>

            {/* 其他表单字段... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Label htmlFor="nickname" className="flex items-center">
                昵称
              </Label>
              <Input
                id="nickname"
                name="nickname"
                value={userInfo.nickname}
                onChange={handleInputChange}
                className="md:col-span-2"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                保存修改
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}