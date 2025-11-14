// 共享的用户类型定义
export interface UserInfo {
    id: string;
    username: string;
    avatar?: string; // 可选：头像地址
    role?: string; // 可选：用户角色
    email: string; // 可选：用户邮箱（根据登录返回数据补充）
  }
  
  // 可选：导出租户类型（如果需要在其他组件使用）
  export type Tenant = {
    id: string;
    name: string;
    desc?: string;
    avatar?: string;
  };