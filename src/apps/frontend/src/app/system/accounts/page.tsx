'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/Table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/Dialog';
import { Input } from '@/src/components/ui/Input';
import { Label } from '@/src/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/Select';

// 模拟账号数据
const accountData = [
  { id: '1', username: 'admin', role: '管理员', status: '启用', createTime: '2025-01-10' },
  { id: '2', username: 'user1', role: '普通用户', status: '启用', createTime: '2025-02-15' },
  { id: '3', username: 'user2', role: '普通用户', status: '禁用', createTime: '2025-03-20' },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState(accountData);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    username: '',
    role: '普通用户',
    status: '启用',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAccount = () => {
    // 实际项目：提交新增账号请求
    const newId = String(accounts.length + 1);
    const account = {
      ...newAccount,
      id: newId,
      createTime: new Date().toLocaleDateString().replace(/\//g, '-'),
    };
    setAccounts([...accounts, account]);
    setIsAddDialogOpen(false);
    setNewAccount({ username: '', role: '普通用户', status: '启用' });
  };

  const handleToggleStatus = (id: string) => {
    // 实际项目：提交状态修改请求
    setAccounts(prev =>
      prev.map(account =>
        account.id === id ? { ...account, status: account.status === '启用' ? '禁用' : '启用' } : account
      )
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">账号管理</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">新增账号</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增账号</DialogTitle>
              <DialogDescription>填写账号信息，创建新用户。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  用户名
                </Label>
                <Input
                  id="username"
                  name="username"
                  value={newAccount.username}
                  onChange={handleInputChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  角色
                </Label>
                <Select
                  name="role"
                  value={newAccount.role}
                  onValueChange={(value) => setNewAccount(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="管理员">管理员</SelectItem>
                    <SelectItem value="普通用户">普通用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  状态
                </Label>
                <Select
                  name="status"
                  value={newAccount.status}
                  onValueChange={(value) => setNewAccount(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="启用">启用</SelectItem>
                    <SelectItem value="禁用">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAddAccount}>
                确认创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号ID</TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.id}</TableCell>
                  <TableCell>{account.username}</TableCell>
                  <TableCell>{account.role}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      account.status === '启用' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {account.status}
                    </span>
                  </TableCell>
                  <TableCell>{account.createTime}</TableCell>
                  <TableCell>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleStatus(account.id)}
                    >
                      {account.status === '启用' ? '禁用' : '启用'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}