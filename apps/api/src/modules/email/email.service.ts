import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | undefined;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = this.configService.get<string>('SMTP_SECURE');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP 配置不完整，邮件服务将无法使用');
      return;
    }

    // 判断是否使用 SSL/TLS
    // secure: true 用于端口 465 (SSL)
    // secure: false 用于端口 587/25 (STARTTLS)
    const isSecure = secure === 'true' || port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      // 连接超时设置
      connectionTimeout: 10000, // 10秒连接超时
      greetingTimeout: 10000,   // 10秒等待服务器问候
      socketTimeout: 30000,     // 30秒 socket 超时
      // TLS 选项 - 对于端口 587 使用 STARTTLS
      tls: {
        rejectUnauthorized: false, // 开发环境可设为 false，生产环境建议设为 true
        minVersion: 'TLSv1.2',
      },
    });

    this.logger.log(`SMTP 配置完成: ${host}:${port} (secure: ${isSecure})`);
  }

  /**
   * 验证 SMTP 连接是否正常
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('邮件服务未初始化');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP 连接验证成功');
      return true;
    } catch (error) {
      this.logger.error(
        `SMTP 连接验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * 同步发送邮件（等待发送完成）
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('邮件服务未初始化，请检查 SMTP 配置');
      return false;
    }

    const fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'eTrunk 平台';
    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || this.configService.get<string>('SMTP_USER');
    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      this.logger.log(`邮件发送成功: ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`邮件发送失败: ${error instanceof Error ? error.message : '未知错误'}`, error instanceof Error ? error.stack : undefined);
      return false;
    }
  }

  /**
   * 异步发送邮件（立即返回，后台发送）
   * 适用于不需要等待发送结果的场景，如密码重置邮件
   */
  sendEmailAsync(options: EmailOptions): void {
    if (!this.transporter) {
      this.logger.error('邮件服务未初始化，请检查 SMTP 配置');
      return;
    }

    // 使用 setImmediate 确保不阻塞当前请求
    setImmediate(async () => {
      const fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'eTrunk 平台';
      const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || this.configService.get<string>('SMTP_USER');
      
      try {
        await this.transporter!.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || this.stripHtml(options.html),
        });

        this.logger.log(`[异步] 邮件发送成功: ${options.to}`);
      } catch (error) {
        this.logger.error(
          `[异步] 邮件发送失败: ${error instanceof Error ? error.message : '未知错误'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    });

    this.logger.log(`[异步] 邮件发送任务已加入队列: ${options.to}`);
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    const expirationMinutes = 30;

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>重置密码</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 30px; text-align: center; background-color: #3b82f6; border-radius: 12px 12px 0 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 16px;">
                      <tr>
                        <td style="width: 60px; height: 60px; background-color: #ffffff; border-radius: 50%; text-align: center; vertical-align: middle;">
                          <span style="font-size: 28px;">🔐</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; font-family: Arial, sans-serif;">重置您的密码</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                      您好，
                    </p>
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                      我们收到了重置您 eTrunk 平台账户密码的请求。请点击下方按钮重置密码：
                    </p>
                    
                    <!-- Button - 使用 table 实现兼容性更好的按钮 -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="border-radius: 8px; background-color: #3b82f6;">
                          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; font-family: Arial, sans-serif; mso-padding-alt: 0;">
                            <!--[if mso]>
                            <i style="letter-spacing: 32px; mso-font-width: -100%; mso-text-raise: 21pt;">&nbsp;</i>
                            <![endif]-->
                            <span style="mso-text-raise: 10pt; color: #ffffff;">重置密码</span>
                            <!--[if mso]>
                            <i style="letter-spacing: 32px; mso-font-width: -100%;">&nbsp;</i>
                            <![endif]-->
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 20px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      或者复制以下链接到浏览器地址栏：
                    </p>
                    <p style="margin: 0 0 20px; padding: 12px; background-color: #f3f4f6; border-radius: 6px; word-break: break-all; color: #3b82f6; font-size: 13px;">
                      ${resetUrl}
                    </p>
                    
                    <!-- Warning -->
                    <div style="margin: 30px 0 0; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                        <strong>⚠️ 安全提示：</strong><br>
                        此链接将在 <strong>${expirationMinutes} 分钟</strong>后过期。如果您没有请求重置密码，请忽略此邮件，您的账户密码不会被更改。
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0 0 10px; color: #9ca3af; font-size: 13px;">
                      此邮件由 eTrunk 平台自动发送，请勿直接回复
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                      © ${new Date().getFullYear()} eTrunk. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 使用异步发送，不阻塞请求
    this.sendEmailAsync({
      to: email,
      subject: '重置您的 eTrunk 平台密码',
      html,
    });

    return true; // 立即返回，邮件在后台发送
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

