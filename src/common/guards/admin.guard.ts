import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const adminToken = request.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    if (expectedToken && adminToken === expectedToken) {
      return true;
    }
    throw new ForbiddenException('Admin access required');
  }
}
