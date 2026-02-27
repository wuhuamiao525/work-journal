/**
 * 认证服务
 */

const API_BASE_URL = 'http://localhost:3001/api';

export interface User {
  id: number;
  username: string;
  displayName: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'auth_user';

  /**
   * 登录
   */
  static async login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const data: LoginResponse = await response.json();

    // 保存token和用户信息
    this.setToken(data.token);
    this.setUser(data.user);

    return data;
  }

  /**
   * 登出
   */
  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * 获取Token
   */
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * 设置Token
   */
  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * 获取当前用户信息
   */
  static getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * 设置用户信息
   */
  static setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * 检查是否已登录
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
