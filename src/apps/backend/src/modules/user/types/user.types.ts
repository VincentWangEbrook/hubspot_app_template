// 假设你的 User 实体类型如下（根据实际项目调整）
import { UserEntity } from '../entities/user.entity';

// 排除密码字段，生成安全用户类型
export type SafeUser = Omit<UserEntity, 'password' | 'createdAt' | 'updatedAt'>;