import { Test, TestingModule } from '@nestjs/testing';
import { AuthUserController } from './user.controller';
import { UserService } from './user.service';

describe('AuthUserController', () => {
  let controller: AuthUserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthUserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            changePassword: jest.fn(),
            verifyJwt: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthUserController>(AuthUserController);
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    /**
     * 测试注册功能
     * 验证输入参数是否正确传递给服务层
     */
    it('should call register with correct parameters', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      };
      await controller.register(registerData);
      expect(service.register).toHaveBeenCalledWith(
        registerData.email,
        registerData.password,
        registerData.displayName,
      );
    });

    /**
     * 测试注册功能边界情况
     * 验证当displayName未提供时是否正确处理
     */
    it('should handle missing displayName', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
      };
      await controller.register(registerData);
      expect(service.register).toHaveBeenCalledWith(
        registerData.email,
        registerData.password,
        undefined,
      );
    });
  });

  describe('login', () => {
    /**
     * 测试登录功能
     * 验证输入参数是否正确传递给服务层
     */
    it('should call login with correct parameters', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };
      await controller.login(loginData);
      expect(service.login).toHaveBeenCalledWith(
        loginData.email,
        loginData.password,
      );
    });
  });

  describe('logout', () => {
    /**
     * 测试登出功能
     * 验证是否调用了服务层的logout方法
     */
    it('should call logout', async () => {
      await controller.logout();
      expect(service.logout).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    /**
     * 测试修改密码功能
     * 验证输入参数是否正确传递给服务层
     */
    it('should call changePassword with correct parameters', async () => {
      const changePasswordData = {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      };
      const mockReq = {
        headers: {
          authorization: 'Bearer mockToken',
        },
      };
      const mockUser = { sub: 'userId123' };
      jest.spyOn(service, 'verifyJwt').mockReturnValue(mockUser);

      await controller.changePassword(mockReq, changePasswordData);
      expect(service.verifyJwt).toHaveBeenCalledWith('mockToken');
      expect(service.changePassword).toHaveBeenCalledWith(
        mockUser.sub,
        changePasswordData.oldPassword,
        changePasswordData.newPassword,
      );
    });

    /**
     * 测试修改密码功能边界情况
     * 验证当未提供Authorization头时是否抛出错误
     */
    it('should throw error if no authorization header', async () => {
      const changePasswordData = {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      };
      const mockReq = {
        headers: {},
      };

      await expect(
        controller.changePassword(mockReq, changePasswordData),
      ).rejects.toThrow('Authorization header is missing');
    });
  });
});