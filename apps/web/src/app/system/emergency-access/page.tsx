'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { apiFetch } from '@/lib/apiFetch';
import { EmergencyAccessRequest } from '@/types';
import { Loader } from '@/components/ui/Loader';
import { PermissionGuard, NoPermissionFallback } from '@/components/PermissionGuard';

export default function EmergencyAccessPage() {
  const [pendingRequests, setPendingRequests] = useState<EmergencyAccessRequest[]>([]);
  const [myRequests, setMyRequests] = useState<EmergencyAccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  // 详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EmergencyAccessRequest | null>(null);

  // 操作状态
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [pendingRes, myRes] = await Promise.all([
        apiFetch<EmergencyAccessRequest[]>('/emergency-access/pending'),
        apiFetch<EmergencyAccessRequest[]>('/emergency-access/my-requests'),
      ]);

      if (pendingRes.success && pendingRes.data) {
        setPendingRequests(pendingRes.data);
      }
      if (myRes.success && myRes.data) {
        setMyRequests(myRes.data);
      }
    } catch (err) {
      setError('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setIsProcessing(true);
    setError('');

    try {
      const res = await apiFetch(`/emergency-access/requests/${id}/approve`, {
        method: 'POST',
      });

      if (res.success) {
        setMessage('请求已批准');
        await loadData();
        setDetailDialogOpen(false);
      } else {
        setError(res.message || '操作失败');
      }
    } catch (err) {
      setError('操作失败');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(true);
    setError('');

    try {
      const res = await apiFetch(`/emergency-access/requests/${id}/reject`, {
        method: 'POST',
        data: {},
      });

      if (res.success) {
        setMessage('请求已拒绝');
        await loadData();
        setDetailDialogOpen(false);
      } else {
        setError(res.message || '操作失败');
      }
    } catch (err) {
      setError('操作失败');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
      expired: '已过期',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <PermissionGuard 
      permissions={['emergency:request', 'emergency:approve']} 
      mode="any"
      fallback={<NoPermissionFallback message="您没有权限访问此页面。此页面仅限系统管理员访问。" />}
    >
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">紧急访问管理</h1>
        <p className="text-sm text-gray-500 mt-1">审批超级管理员的租户数据访问请求</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {message}
        </div>
      )}

      {/* 待审批请求 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            待审批请求
            {pendingRequests.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>申请人</TableHead>
                <TableHead>目标租户</TableHead>
                <TableHead>申请原因</TableHead>
                <TableHead>申请时间</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    暂无待审批的请求
                  </TableCell>
                </TableRow>
              ) : (
                pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.requester?.username}</div>
                        <div className="text-sm text-gray-500">{request.requester?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{request.tenant?.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell>{formatDate(request.expiresAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setDetailDialogOpen(true);
                          }}
                        >
                          查看
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 我的请求历史 */}
      <Card>
        <CardHeader>
          <CardTitle>我的请求历史</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>目标租户</TableHead>
                <TableHead>申请原因</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>审批人</TableHead>
                <TableHead>申请时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    暂无请求记录
                  </TableCell>
                </TableRow>
              ) : (
                myRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.tenant?.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{request.approver?.username || '-'}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>紧急访问请求详情</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">申请人</label>
                  <p className="mt-1">{selectedRequest.requester?.username}</p>
                  <p className="text-sm text-gray-500">{selectedRequest.requester?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">目标租户</label>
                  <p className="mt-1">{selectedRequest.tenant?.name}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">申请原因</label>
                <p className="mt-1 p-3 bg-gray-50 rounded">{selectedRequest.reason}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">申请访问范围</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedRequest.scope.map((s, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">申请时间</label>
                  <p className="mt-1">{formatDate(selectedRequest.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">过期时间</label>
                  <p className="mt-1">{formatDate(selectedRequest.expiresAt)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => handleReject(selectedRequest.id)}
                  disabled={isProcessing}
                >
                  拒绝
                </Button>
                <Button
                  onClick={() => handleApprove(selectedRequest.id)}
                  disabled={isProcessing}
                >
                  批准
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PermissionGuard>
  );
}

