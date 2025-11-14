import { IsEmail, IsString, MinLength } from 'class-validator';

// 登录请求 DTO（校验输入格式）
export class LoginDto {
  @IsEmail({}, { message: '请输入合法的邮箱地址' }) // 验证邮箱格式
  email!: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度不能少于 6 位' }) // 验证密码最小长度
  password!: string;
}