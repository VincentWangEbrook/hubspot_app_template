import { User } from '@prisma/client';

// 排除密码字段，生成安全用户类型
export type SafeUser = Omit<User, 'password'>;