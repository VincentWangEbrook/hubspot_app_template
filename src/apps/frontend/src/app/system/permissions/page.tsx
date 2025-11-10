'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Checkbox } from '@/src/components/ui/Checkbox';
import { Label } from '@/src/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/Select';
import { Separator } from '@/src/components/ui/Separator';

// 模拟角色和权限数据
const roles = ['管理员', '普通用户', '只读用户'];
const permissionGroups = [
  {
    groupName: '仪表盘',
    permissions: ['查看仪表盘数据', '导出仪表盘数据'],
  },
  {
    groupName: '账号管理',
    permissions: ['查看账号列表', '新增账号', '修改账号', '禁用账号'],
  },
  {
    groupName: '权限配置',
    permissions: ['查看角色列表', '新增角色', '分配权限'],
  },
];

export default function PermissionsPage() {
  const [selectedRole, setSelectedRole] = useState(roles[0]);
  // 模拟权限配置（管理员默认全选，其他角色部分选中）
  const [rolePermissions, setRolePermissions] = useState(
    permissionGroups.map(group => ({
      groupName: group.groupName,
      permissions: group.permissions.map(perm => ({
        name: perm,
        isChecked: selectedRole === '管理员',
      })),
    }))
  );

  // 切换角色时更新权限选中状态
  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    // 模拟不同角色的默认权限
    const newPermissions = permissionGroups.map(group => ({
      groupName: group.groupName,
      permissions: group.permissions.map(perm => ({
        name: perm,
        isChecked: role === '管理员' 
          ? true 
          : role === '普通用户' 
            ? !perm.includes('新增') && !perm.includes('修改') && !perm.includes('禁用') && !perm.includes('权限')
            : perm.includes('查看'),
      })),
    }));
    setRolePermissions(newPermissions);
  };

  // 切换权限选中状态
  const handlePermissionToggle = (groupIndex: number, permIndex: number) => {
    const newPermissions = [...rolePermissions];
    newPermissions[groupIndex].permissions[permIndex].isChecked = 
      !newPermissions[groupIndex].permissions[permIndex].isChecked;
    setRolePermissions(newPermissions);
  };

  // 保存权限配置
  const handleSavePermissions = () => {
    // 实际项目：提交权限配置到服务器
    alert(`已保存 ${selectedRole} 的权限配置！`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">权限配置</h1>

      <Card>
        <CardHeader>
          <CardTitle>角色权限分配</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 选择角色 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <Label htmlFor="role-select" className="text-right">
                选择角色
              </Label>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger id="role-select" className="col-span-3">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* 权限列表 */}
            <div className="space-y-6">
              {rolePermissions.map((group, groupIndex) => (
                <div key={group.groupName}>
                  <h3 className="font-medium text-gray-900 mb-3">{group.groupName}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {group.permissions.map((perm, permIndex) => (
                      <div key={perm.name} className="flex items-center space-x-2">
                        <Checkbox
                          id={`perm-${groupIndex}-${permIndex}`}
                          checked={perm.isChecked}
                          onCheckedChange={() => handlePermissionToggle(groupIndex, permIndex)}
                        />
                        <Label
                          htmlFor={`perm-${groupIndex}-${permIndex}`}
                          className="text-gray-700 cursor-pointer"
                        >
                          {perm.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <Button onClick={handleSavePermissions} className="bg-blue-600 hover:bg-blue-700">
                保存权限配置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}