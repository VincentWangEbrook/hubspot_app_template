import { Controller, Post, Body, Get } from '@nestjs/common';
import { EmailService } from './email.service';
import { Public } from '../../common/security/public.decorator';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * 验证 SMTP 连接
   * GET /api/email/verify
   */
  @Public()
  @Get('verify')
  async verifyConnection() {
    const isConnected = await this.emailService.verifyConnection();
    return {
      success: isConnected,
      message: isConnected ? 'SMTP 连接正常' : 'SMTP 连接失败，请检查配置',
    };
  }

  /**
   * 发送测试邮件
   * POST /api/email/test
   * Body: { "to": "test@example.com" }
   */
  @Public()
  @Post('test')
  async sendTestEmail(@Body() body: { to: string }) {
    if (!body.to) {
      return {
        success: false,
        message: '请提供收件人邮箱地址',
      };
    }

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">🎉 邮件测试成功！</h2>
          <p style="color: #666; line-height: 1.6;">
            如果您收到这封邮件，说明 SMTP 配置正确，邮件服务工作正常。
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
          </p>
        </div>
      </div>
    `;

    const success = await this.emailService.sendEmail({
      to: body.to,
      subject: '【测试】eTrunk 平台邮件服务测试',
      html,
    });

    return {
      success,
      message: success ? `测试邮件已发送至 ${body.to}` : '邮件发送失败，请检查控制台日志',
    };
  }
}

